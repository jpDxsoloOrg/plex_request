import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getItem, updateItem, REQUESTS_TABLE } from '../../../lib/dynamodb';
import { requireAdmin } from '../../../lib/auth';
import { success, badRequest, notFound, forbidden, serverError } from '../../../lib/response';
import { handleApproval } from '../../../lib/approval';
import type { MediaRequest, RequestStatus } from '../../../types';
import { VALID_STATUS_TRANSITIONS as transitions } from '../../../types';
import { sendStatusChangeEmail } from '../../../lib/email';

interface UpdateStatusBody {
  status: RequestStatus;
  adminNote?: string;
}

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const admin = requireAdmin(event);
  if (!admin) {
    return forbidden('Admin access required');
  }

  const requestId = event.pathParameters?.id;
  if (!requestId) {
    return badRequest('Request ID is required');
  }

  if (!event.body) {
    return badRequest('Request body is required');
  }

  const body = JSON.parse(event.body) as UpdateStatusBody;

  if (!body.status) {
    return badRequest('status is required');
  }

  try {
    const request = await getItem({
      TableName: REQUESTS_TABLE,
      Key: { requestId },
    }) as MediaRequest | undefined;

    if (!request) {
      return notFound('Request not found');
    }

    // Validate status transition
    const allowedTransitions = transitions[request.status];
    if (!allowedTransitions.includes(body.status)) {
      return badRequest(
        `Cannot transition from "${request.status}" to "${body.status}". ` +
        `Allowed: ${allowedTransitions.join(', ') || 'none'}`
      );
    }

    // On approval, trigger Radarr/Sonarr integration
    let integrationIds: { radarrId?: number; sonarrId?: number } = {};
    if (body.status === 'approved') {
      try {
        integrationIds = await handleApproval(request);
      } catch (integrationError) {
        console.error('Integration error:', integrationError);
        const message = integrationError instanceof Error
          ? integrationError.message
          : 'Failed to add media to download service';
        return badRequest(`Approval failed: ${message}`);
      }
    }

    const now = new Date().toISOString();

    const updateExpression = [
      '#status = :status',
      'updatedAt = :updatedAt',
    ];
    const expressionValues: Record<string, unknown> = {
      ':status': body.status,
      ':updatedAt': now,
    };
    const expressionNames: Record<string, string> = {
      '#status': 'status',
    };

    if (body.adminNote !== undefined) {
      updateExpression.push('adminNote = :adminNote');
      expressionValues[':adminNote'] = body.adminNote;
    }

    if (integrationIds.radarrId) {
      updateExpression.push('radarrId = :radarrId');
      expressionValues[':radarrId'] = integrationIds.radarrId;
    }

    if (integrationIds.sonarrId) {
      updateExpression.push('sonarrId = :sonarrId');
      expressionValues[':sonarrId'] = integrationIds.sonarrId;
    }

    const updated = await updateItem({
      TableName: REQUESTS_TABLE,
      Key: { requestId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      ReturnValues: 'ALL_NEW',
    });

    // Send email notification (non-blocking — failure doesn't affect the response)
    try {
      await sendStatusChangeEmail({
        recipientEmail: request.userName,
        title: request.title,
        mediaType: request.mediaType,
        newStatus: body.status,
        adminNote: body.adminNote,
      });
    } catch (emailError) {
      console.error('Failed to send status change email:', emailError);
    }

    return success(updated);
  } catch (error) {
    console.error('Update request status error:', error);
    return serverError('Failed to update request status');
  }
};

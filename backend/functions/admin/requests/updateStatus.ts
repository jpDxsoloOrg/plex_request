import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getItem, updateItem, REQUESTS_TABLE } from '../../../lib/dynamodb';
import { requireAdmin } from '../../../lib/auth';
import { success, badRequest, notFound, forbidden, serverError } from '../../../lib/response';
import { getServiceSetting } from '../../../lib/settings';
import * as radarr from '../../../lib/integrations/radarr';
import * as sonarr from '../../../lib/integrations/sonarr';
import type { MediaRequest, RequestStatus } from '../../../types';
import { VALID_STATUS_TRANSITIONS as transitions } from '../../../types';
import { sendStatusChangeEmail } from '../../../lib/email';

interface UpdateStatusBody {
  status: RequestStatus;
  adminNote?: string;
}

async function handleApproval(request: MediaRequest): Promise<{ radarrId?: number; sonarrId?: number }> {
  if (request.mediaType === 'movie') {
    const setting = await getServiceSetting('radarr');

    if (!setting.enabled || !setting.baseUrl || !setting.apiKey) {
      throw new Error('Radarr is not configured or disabled');
    }
    if (!setting.qualityProfileId || !setting.rootFolderPath) {
      throw new Error('Radarr quality profile and root folder must be configured in Settings');
    }

    const config = { baseUrl: setting.baseUrl, apiKey: setting.apiKey };
    const movie = await radarr.addMovie(
      config,
      request.tmdbId,
      setting.qualityProfileId,
      setting.rootFolderPath
    );

    return { radarrId: movie.id };
  }

  if (request.mediaType === 'tv') {
    const setting = await getServiceSetting('sonarr');

    if (!setting.enabled || !setting.baseUrl || !setting.apiKey) {
      throw new Error('Sonarr is not configured or disabled');
    }
    if (!setting.qualityProfileId || !setting.rootFolderPath) {
      throw new Error('Sonarr quality profile and root folder must be configured in Settings');
    }

    const config = { baseUrl: setting.baseUrl, apiKey: setting.apiKey };

    // Sonarr lookup accepts tmdb:<id> format — find the correct match
    const results = await sonarr.lookupSeries(config, `tmdb:${request.tmdbId}`);
    if (!results.length) {
      throw new Error(`Series not found in Sonarr for TMDB ID ${request.tmdbId}`);
    }

    // Match by tmdbId first, fall back to title match, then first result
    const match = results.find((r) => r.tmdbId === request.tmdbId)
      ?? results.find((r) => r.title.toLowerCase() === request.title.toLowerCase())
      ?? results[0];

    const series = await sonarr.addSeries(
      config,
      match.tvdbId,
      setting.qualityProfileId,
      setting.rootFolderPath,
      request.seasons,
      setting.languageProfileId
    );

    return { sonarrId: series.id };
  }

  return {};
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

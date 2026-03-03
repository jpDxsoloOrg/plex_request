import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getItem, updateItem, ISSUES_TABLE } from '../../../lib/dynamodb';
import { requireAdmin } from '../../../lib/auth';
import { success, badRequest, notFound, forbidden, serverError } from '../../../lib/response';
import type { MediaIssue, IssueStatus } from '../../../types';

const VALID_STATUSES: IssueStatus[] = ['open', 'acknowledged', 'resolved'];

interface UpdateIssueBody {
  status: IssueStatus;
  adminNote?: string;
}

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const admin = requireAdmin(event);
  if (!admin) {
    return forbidden('Admin access required');
  }

  const issueId = event.pathParameters?.id;
  if (!issueId) {
    return badRequest('Issue ID is required');
  }

  if (!event.body) {
    return badRequest('Request body is required');
  }

  const body = JSON.parse(event.body) as UpdateIssueBody;

  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return badRequest(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  try {
    const issue = await getItem({
      TableName: ISSUES_TABLE,
      Key: { issueId },
    }) as MediaIssue | undefined;

    if (!issue) {
      return notFound('Issue not found');
    }

    const updateExpression = ['#status = :status', 'updatedAt = :updatedAt'];
    const expressionValues: Record<string, unknown> = {
      ':status': body.status,
      ':updatedAt': new Date().toISOString(),
    };
    const expressionNames: Record<string, string> = { '#status': 'status' };

    if (body.adminNote !== undefined) {
      updateExpression.push('adminNote = :adminNote');
      expressionValues[':adminNote'] = body.adminNote;
    }

    const updated = await updateItem({
      TableName: ISSUES_TABLE,
      Key: { issueId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      ReturnValues: 'ALL_NEW',
    });

    return success(updated);
  } catch (error) {
    console.error('Update issue status error:', error);
    return serverError('Failed to update issue status');
  }
};

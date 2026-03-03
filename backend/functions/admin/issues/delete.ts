import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getItem, deleteItem, ISSUES_TABLE } from '../../../lib/dynamodb';
import { requireAdmin } from '../../../lib/auth';
import { noContent, badRequest, notFound, forbidden, serverError } from '../../../lib/response';
import type { MediaIssue } from '../../../types';

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

  try {
    const issue = await getItem({
      TableName: ISSUES_TABLE,
      Key: { issueId },
    }) as MediaIssue | undefined;

    if (!issue) {
      return notFound('Issue not found');
    }

    await deleteItem({
      TableName: ISSUES_TABLE,
      Key: { issueId },
    });

    return noContent();
  } catch (error) {
    console.error('Admin delete issue error:', error);
    return serverError('Failed to delete issue');
  }
};

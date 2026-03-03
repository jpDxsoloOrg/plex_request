import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getItem, deleteItem, ISSUES_TABLE } from '../../lib/dynamodb';
import { getUserContext } from '../../lib/auth';
import { noContent, badRequest, notFound, forbidden, serverError } from '../../lib/response';
import type { MediaIssue } from '../../types';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const issueId = event.pathParameters?.id;
  if (!issueId) {
    return badRequest('Issue ID is required');
  }

  const user = getUserContext(event);

  try {
    const issue = await getItem({
      TableName: ISSUES_TABLE,
      Key: { issueId },
    }) as MediaIssue | undefined;

    if (!issue) {
      return notFound('Issue not found');
    }

    if (issue.userId !== user.userId) {
      return forbidden('You can only delete your own issues');
    }

    if (issue.status !== 'open') {
      return badRequest('Can only delete open issues');
    }

    await deleteItem({
      TableName: ISSUES_TABLE,
      Key: { issueId },
    });

    return noContent();
  } catch (error) {
    console.error('Delete issue error:', error);
    return serverError('Failed to delete issue');
  }
};

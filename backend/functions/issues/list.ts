import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { query, ISSUES_TABLE } from '../../lib/dynamodb';
import { getUserContext } from '../../lib/auth';
import { success, serverError } from '../../lib/response';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const user = getUserContext(event);

  try {
    const issues = await query({
      TableName: ISSUES_TABLE,
      IndexName: 'UserIssueIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': user.userId },
      ScanIndexForward: false,
    });

    return success({ issues });
  } catch (error) {
    console.error('List issues error:', error);
    return serverError('Failed to list issues');
  }
};

import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { query, REQUESTS_TABLE } from '../../lib/dynamodb';
import { getUserContext } from '../../lib/auth';
import { success, serverError } from '../../lib/response';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const user = getUserContext(event);

  try {
    const requests = await query({
      TableName: REQUESTS_TABLE,
      IndexName: 'UserIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': user.userId,
      },
      ScanIndexForward: false, // newest first
    });

    return success({ requests });
  } catch (error) {
    console.error('List requests error:', error);
    return serverError('Failed to list requests');
  }
};

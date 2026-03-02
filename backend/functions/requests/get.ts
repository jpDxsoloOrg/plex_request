import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getItem, REQUESTS_TABLE } from '../../lib/dynamodb';
import { getUserContext, isAdmin } from '../../lib/auth';
import { success, notFound, forbidden, serverError } from '../../lib/response';
import type { MediaRequest } from '../../types';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.pathParameters?.id;

  if (!requestId) {
    return notFound('Request not found');
  }

  const user = getUserContext(event);

  try {
    const request = await getItem({
      TableName: REQUESTS_TABLE,
      Key: { requestId },
    }) as MediaRequest | undefined;

    if (!request) {
      return notFound('Request not found');
    }

    // Only the owner or an admin can view the request
    if (request.userId !== user.userId && !isAdmin(user)) {
      return forbidden('You do not have permission to view this request');
    }

    return success(request);
  } catch (error) {
    console.error('Get request error:', error);
    return serverError('Failed to get request');
  }
};

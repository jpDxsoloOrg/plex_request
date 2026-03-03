import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getItem, deleteItem, REQUESTS_TABLE } from '../../lib/dynamodb';
import { getUserContext } from '../../lib/auth';
import { success, badRequest, notFound, forbidden, serverError } from '../../lib/response';
import type { MediaRequest } from '../../types';

const DELETABLE_STATUSES = ['completed', 'rejected', 'complete'];

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

    if (request.userId !== user.userId) {
      return forbidden('You can only delete your own requests');
    }

    if (!DELETABLE_STATUSES.includes(request.status)) {
      return badRequest('You can only delete completed or rejected requests');
    }

    await deleteItem({
      TableName: REQUESTS_TABLE,
      Key: { requestId },
    });

    return success({ message: 'Request deleted' });
  } catch (error) {
    console.error('Delete request error:', error);
    return serverError('Failed to delete request');
  }
};

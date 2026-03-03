import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getItem, deleteItem, REQUESTS_TABLE } from '../../../lib/dynamodb';
import { requireAdmin } from '../../../lib/auth';
import { success, notFound, forbidden, serverError } from '../../../lib/response';
import type { MediaRequest } from '../../../types';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const admin = requireAdmin(event);
  if (!admin) {
    return forbidden('Admin access required');
  }

  const requestId = event.pathParameters?.id;
  if (!requestId) {
    return notFound('Request not found');
  }

  try {
    const request = await getItem({
      TableName: REQUESTS_TABLE,
      Key: { requestId },
    }) as MediaRequest | undefined;

    if (!request) {
      return notFound('Request not found');
    }

    await deleteItem({
      TableName: REQUESTS_TABLE,
      Key: { requestId },
    });

    return success({ message: 'Request deleted' });
  } catch (error) {
    console.error('Admin delete request error:', error);
    return serverError('Failed to delete request');
  }
};

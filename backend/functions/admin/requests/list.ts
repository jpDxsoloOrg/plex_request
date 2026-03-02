import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { query, scan, REQUESTS_TABLE } from '../../../lib/dynamodb';
import { requireAdmin } from '../../../lib/auth';
import { success, forbidden, serverError } from '../../../lib/response';
import type { RequestStatus } from '../../../types';

const VALID_STATUSES: RequestStatus[] = ['requested', 'approved', 'downloading', 'complete', 'rejected'];

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const admin = requireAdmin(event);
  if (!admin) {
    return forbidden('Admin access required');
  }

  const status = event.queryStringParameters?.status as RequestStatus | undefined;

  try {
    if (status && VALID_STATUSES.includes(status)) {
      const requests = await query({
        TableName: REQUESTS_TABLE,
        IndexName: 'StatusIndex',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': status },
        ScanIndexForward: false,
      });
      return success({ requests });
    }

    // No status filter — return all requests sorted by most recent
    const requests = await scan({
      TableName: REQUESTS_TABLE,
    });

    // Sort by requestedAt descending (scan doesn't guarantee order)
    requests.sort((a, b) =>
      (b.requestedAt as string).localeCompare(a.requestedAt as string)
    );

    return success({ requests });
  } catch (error) {
    console.error('Admin list requests error:', error);
    return serverError('Failed to list requests');
  }
};

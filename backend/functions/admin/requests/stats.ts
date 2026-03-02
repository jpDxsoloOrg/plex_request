import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { query, queryCount, REQUESTS_TABLE } from '../../../lib/dynamodb';
import { requireAdmin } from '../../../lib/auth';
import { success, forbidden, serverError } from '../../../lib/response';
import type { RequestStatus } from '../../../types';

const STATUSES: RequestStatus[] = ['requested', 'approved', 'downloading', 'complete', 'rejected'];

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const admin = requireAdmin(event);
  if (!admin) {
    return forbidden('Admin access required');
  }

  try {
    const counts: Record<string, number> = {};

    // Count requests per status using the StatusIndex
    for (const status of STATUSES) {
      counts[status] = await queryCount({
        TableName: REQUESTS_TABLE,
        IndexName: 'StatusIndex',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': status },
      });
    }

    // Get recent activity (last 10 pending requests)
    const recentRequested = await query({
      TableName: REQUESTS_TABLE,
      IndexName: 'StatusIndex',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'requested' },
      ScanIndexForward: false,
      Limit: 10,
    });

    return success({
      counts,
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
      recentRequests: recentRequested,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return serverError('Failed to get request stats');
  }
};

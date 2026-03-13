import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { scan, REQUESTS_TABLE } from '../../../lib/dynamodb';
import { requireAdmin } from '../../../lib/auth';
import { success, forbidden, serverError } from '../../../lib/response';
import { buildDownloadStatuses } from '../../requests/downloadStatus';
import type { MediaRequest } from '../../../types';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const admin = requireAdmin(event);
  if (!admin) {
    return forbidden('Admin access required');
  }

  try {
    const allRequests = await scan({ TableName: REQUESTS_TABLE }) as MediaRequest[];
    const activeRequests = allRequests.filter(
      (r) => r.status === 'approved' || r.status === 'downloading'
    );

    if (activeRequests.length === 0) {
      return success({ statuses: {} });
    }

    const statuses = await buildDownloadStatuses(activeRequests);
    return success({ statuses });
  } catch (error) {
    console.error('Admin download status error:', error);
    return serverError('Failed to fetch download status');
  }
};

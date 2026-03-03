import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { query, scan, ISSUES_TABLE } from '../../../lib/dynamodb';
import { requireAdmin } from '../../../lib/auth';
import { success, forbidden, serverError } from '../../../lib/response';
import type { IssueStatus } from '../../../types';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const admin = requireAdmin(event);
  if (!admin) {
    return forbidden('Admin access required');
  }

  const statusFilter = event.queryStringParameters?.status as IssueStatus | undefined;

  try {
    let issues;
    if (statusFilter) {
      issues = await query({
        TableName: ISSUES_TABLE,
        IndexName: 'StatusIssueIndex',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': statusFilter },
        ScanIndexForward: false,
      });
    } else {
      issues = await scan({ TableName: ISSUES_TABLE });
      issues.sort((a, b) => {
        const aDate = (a as { reportedAt: string }).reportedAt;
        const bDate = (b as { reportedAt: string }).reportedAt;
        return bDate.localeCompare(aDate);
      });
    }

    return success({ issues });
  } catch (error) {
    console.error('Admin list issues error:', error);
    return serverError('Failed to list issues');
  }
};

import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { requireAdmin } from '../../../lib/auth';
import { scan, queryCount, USER_PREFERENCES_TABLE, REQUESTS_TABLE } from '../../../lib/dynamodb';
import { success, forbidden, serverError } from '../../../lib/response';
import type { AdminUser, UserPreference } from '../../../types';

const cognito = new CognitoIdentityProviderClient({});
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const admin = requireAdmin(event);
  if (!admin) {
    return forbidden('Admin access required');
  }

  try {
    // Fetch all Cognito users (paginate if needed)
    const cognitoUsers: Array<{
      userId: string;
      email: string;
      status: string;
      createdAt: string;
    }> = [];

    let paginationToken: string | undefined;
    do {
      const command = new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        Limit: 60,
        PaginationToken: paginationToken,
      });
      const result = await cognito.send(command);

      for (const user of result.Users ?? []) {
        const sub = user.Attributes?.find((a) => a.Name === 'sub')?.Value ?? '';
        const email = user.Attributes?.find((a) => a.Name === 'email')?.Value ?? '';
        cognitoUsers.push({
          userId: sub,
          email,
          status: user.UserStatus ?? 'UNKNOWN',
          createdAt: user.UserCreateDate?.toISOString() ?? '',
        });
      }

      paginationToken = result.PaginationToken;
    } while (paginationToken);

    // Fetch all user preferences
    const prefs = await scan({ TableName: USER_PREFERENCES_TABLE }) as UserPreference[];
    const prefMap = new Map(prefs.map((p) => [p.userId, p]));

    // Fetch request counts per user in parallel
    const countPromises = cognitoUsers.map(async (u) => {
      const count = await queryCount({
        TableName: REQUESTS_TABLE,
        IndexName: 'UserIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': u.userId },
      });
      return { userId: u.userId, count };
    });
    const counts = await Promise.all(countPromises);
    const countMap = new Map(counts.map((c) => [c.userId, c.count]));

    const users: AdminUser[] = cognitoUsers.map((u) => ({
      userId: u.userId,
      email: u.email,
      status: u.status,
      autoApprove: prefMap.get(u.userId)?.autoApprove ?? false,
      requestCount: countMap.get(u.userId) ?? 0,
      createdAt: u.createdAt,
    }));

    return success({ users });
  } catch (error) {
    console.error('List users error:', error);
    return serverError('Failed to list users');
  }
};

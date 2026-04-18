import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { requireAdmin } from '../../../lib/auth';
import { putItem, USER_PREFERENCES_TABLE } from '../../../lib/dynamodb';
import { success, badRequest, notFound, forbidden, serverError } from '../../../lib/response';
import type { UserPreference } from '../../../types';

const cognito = new CognitoIdentityProviderClient({});
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const admin = requireAdmin(event);
  if (!admin) {
    return forbidden('Admin access required');
  }

  const userId = event.pathParameters?.userId;
  if (!userId) {
    return badRequest('userId is required');
  }

  if (!event.body) {
    return badRequest('Request body is required');
  }

  const body = JSON.parse(event.body) as { autoApprove: boolean };
  if (typeof body.autoApprove !== 'boolean') {
    return badRequest('autoApprove must be a boolean');
  }

  try {
    // Verify user exists in Cognito (AdminGetUser requires username, so use sub filter)
    const listCmd = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Filter: `sub = "${userId}"`,
      Limit: 1,
    });
    const result = await cognito.send(listCmd);
    if (!result.Users?.length) {
      return notFound('User not found');
    }

    const pref: UserPreference = {
      userId,
      autoApprove: body.autoApprove,
      updatedAt: new Date().toISOString(),
    };

    await putItem({
      TableName: USER_PREFERENCES_TABLE,
      Item: pref,
    });

    return success(pref);
  } catch (error) {
    console.error('Update auto-approve error:', error);
    return serverError('Failed to update auto-approve setting');
  }
};

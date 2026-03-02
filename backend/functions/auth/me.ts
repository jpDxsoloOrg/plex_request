import {
  CognitoIdentityProviderClient,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { success, unauthorized, serverError } from '../../lib/response';

const cognito = new CognitoIdentityProviderClient({});

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const token = event.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return unauthorized('No token provided');
  }

  try {
    const result = await cognito.send(
      new GetUserCommand({
        AccessToken: token,
      })
    );

    const attributes: Record<string, string> = {};
    for (const attr of result.UserAttributes ?? []) {
      if (attr.Name && attr.Value) {
        attributes[attr.Name] = attr.Value;
      }
    }

    // Extract groups from JWT claims in the request context (set by API Gateway JWT authorizer)
    const jwtContext = (
      event.requestContext as unknown as {
        authorizer?: { jwt?: { claims?: Record<string, string> } };
      }
    ).authorizer?.jwt?.claims;

    const groupsClaim = jwtContext?.['cognito:groups'] ?? '';
    const groups = groupsClaim
      ? groupsClaim.replace(/[[\]]/g, '').trim().split(/\s+/)
      : [];

    return success({
      userId: attributes.sub ?? result.Username,
      email: attributes.email ?? '',
      name: attributes.name ?? '',
      emailVerified: attributes.email_verified === 'true',
      groups,
    });
  } catch (error: unknown) {
    const cognitoError = error as { name?: string };

    if (cognitoError.name === 'NotAuthorizedException') {
      return unauthorized('Token is invalid or expired');
    }

    console.error('Get user error:', error);
    return serverError('Failed to get user profile');
  }
};

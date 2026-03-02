import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { success, badRequest, unauthorized, serverError } from '../../lib/response';

const cognito = new CognitoIdentityProviderClient({});
const clientId = process.env.COGNITO_CLIENT_ID ?? '';

interface RefreshBody {
  refreshToken: string;
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  if (!event.body) {
    return badRequest('Request body is required');
  }

  const body = JSON.parse(event.body) as RefreshBody;

  if (!body.refreshToken) {
    return badRequest('refreshToken is required');
  }

  try {
    const result = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: clientId,
        AuthParameters: {
          REFRESH_TOKEN: body.refreshToken,
        },
      })
    );

    const authResult = result.AuthenticationResult;

    if (!authResult) {
      return unauthorized('Token refresh failed');
    }

    return success({
      accessToken: authResult.AccessToken,
      idToken: authResult.IdToken,
      expiresIn: authResult.ExpiresIn,
    });
  } catch (error: unknown) {
    const cognitoError = error as { name?: string; message?: string };

    if (cognitoError.name === 'NotAuthorizedException') {
      return unauthorized('Refresh token is invalid or expired');
    }

    console.error('Refresh error:', error);
    return serverError('Failed to refresh token');
  }
};

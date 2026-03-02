import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { success, badRequest, unauthorized, serverError } from '../../lib/response';

const cognito = new CognitoIdentityProviderClient({});
const clientId = process.env.COGNITO_CLIENT_ID ?? '';

interface LoginBody {
  email: string;
  password: string;
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  if (!event.body) {
    return badRequest('Request body is required');
  }

  const body = JSON.parse(event.body) as LoginBody;

  if (!body.email || !body.password) {
    return badRequest('email and password are required');
  }

  try {
    const result = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: clientId,
        AuthParameters: {
          USERNAME: body.email,
          PASSWORD: body.password,
        },
      })
    );

    const authResult = result.AuthenticationResult;

    if (!authResult) {
      return unauthorized('Authentication failed');
    }

    return success({
      accessToken: authResult.AccessToken,
      idToken: authResult.IdToken,
      refreshToken: authResult.RefreshToken,
      expiresIn: authResult.ExpiresIn,
    });
  } catch (error: unknown) {
    const cognitoError = error as { name?: string; message?: string };

    if (cognitoError.name === 'NotAuthorizedException') {
      return unauthorized('Invalid email or password');
    }
    if (cognitoError.name === 'UserNotConfirmedException') {
      return badRequest('Please confirm your email before logging in');
    }
    if (cognitoError.name === 'UserNotFoundException') {
      return unauthorized('Invalid email or password');
    }

    console.error('Login error:', error);
    return serverError('Failed to authenticate');
  }
};

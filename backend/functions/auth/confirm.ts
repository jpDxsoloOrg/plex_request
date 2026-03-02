import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { success, badRequest, serverError } from '../../lib/response';

const cognito = new CognitoIdentityProviderClient({});
const clientId = process.env.COGNITO_CLIENT_ID ?? '';

interface ConfirmBody {
  email: string;
  code: string;
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  if (!event.body) {
    return badRequest('Request body is required');
  }

  const body = JSON.parse(event.body) as ConfirmBody;

  if (!body.email || !body.code) {
    return badRequest('email and code are required');
  }

  try {
    await cognito.send(
      new ConfirmSignUpCommand({
        ClientId: clientId,
        Username: body.email,
        ConfirmationCode: body.code,
      })
    );

    return success({ message: 'Email confirmed. You can now log in.' });
  } catch (error: unknown) {
    const cognitoError = error as { name?: string; message?: string };

    if (cognitoError.name === 'CodeMismatchException') {
      return badRequest('Invalid confirmation code');
    }
    if (cognitoError.name === 'ExpiredCodeException') {
      return badRequest('Confirmation code has expired');
    }

    console.error('Confirm error:', error);
    return serverError('Failed to confirm email');
  }
};

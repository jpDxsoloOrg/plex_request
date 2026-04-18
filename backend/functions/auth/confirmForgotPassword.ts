import {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { success, badRequest, serverError } from '../../lib/response';

const cognito = new CognitoIdentityProviderClient({});
const clientId = process.env.COGNITO_CLIENT_ID ?? '';

interface ConfirmForgotPasswordBody {
  email: string;
  code: string;
  password: string;
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  if (!event.body) {
    return badRequest('Request body is required');
  }

  const body = JSON.parse(event.body) as ConfirmForgotPasswordBody;

  if (!body.email || !body.code || !body.password) {
    return badRequest('email, code, and password are required');
  }

  try {
    await cognito.send(
      new ConfirmForgotPasswordCommand({
        ClientId: clientId,
        Username: body.email,
        ConfirmationCode: body.code,
        Password: body.password,
      })
    );

    return success({ message: 'Password reset successfully. You can now log in.' });
  } catch (error: unknown) {
    const cognitoError = error as { name?: string; message?: string };

    if (cognitoError.name === 'CodeMismatchException') {
      return badRequest('Invalid reset code');
    }
    if (cognitoError.name === 'ExpiredCodeException') {
      return badRequest('Reset code has expired. Request a new one.');
    }
    if (cognitoError.name === 'InvalidPasswordException') {
      return badRequest(cognitoError.message ?? 'Password does not meet requirements');
    }
    if (cognitoError.name === 'UserNotFoundException') {
      return badRequest('Invalid reset code');
    }
    if (cognitoError.name === 'LimitExceededException') {
      return badRequest('Too many attempts. Please try again later.');
    }

    console.error('ConfirmForgotPassword error:', error);
    return serverError('Failed to reset password');
  }
};

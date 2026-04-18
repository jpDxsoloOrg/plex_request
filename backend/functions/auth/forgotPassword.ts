import {
  CognitoIdentityProviderClient,
  ForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { success, badRequest, serverError } from '../../lib/response';

const cognito = new CognitoIdentityProviderClient({});
const clientId = process.env.COGNITO_CLIENT_ID ?? '';

interface ForgotPasswordBody {
  email: string;
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  if (!event.body) {
    return badRequest('Request body is required');
  }

  const body = JSON.parse(event.body) as ForgotPasswordBody;

  if (!body.email) {
    return badRequest('email is required');
  }

  try {
    await cognito.send(
      new ForgotPasswordCommand({
        ClientId: clientId,
        Username: body.email,
      })
    );

    return success({
      message: 'If an account exists for that email, a reset code has been sent.',
    });
  } catch (error: unknown) {
    const cognitoError = error as { name?: string; message?: string };

    if (
      cognitoError.name === 'UserNotFoundException' ||
      cognitoError.name === 'InvalidParameterException'
    ) {
      return success({
        message: 'If an account exists for that email, a reset code has been sent.',
      });
    }
    if (cognitoError.name === 'LimitExceededException') {
      return badRequest('Too many attempts. Please try again later.');
    }

    console.error('ForgotPassword error:', error);
    return serverError('Failed to initiate password reset');
  }
};

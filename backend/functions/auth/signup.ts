import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { success, badRequest, serverError } from '../../lib/response';

const cognito = new CognitoIdentityProviderClient({});
const clientId = process.env.COGNITO_CLIENT_ID ?? '';

interface SignupBody {
  email: string;
  password: string;
  name?: string;
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  if (!event.body) {
    return badRequest('Request body is required');
  }

  const body = JSON.parse(event.body) as SignupBody;

  if (!body.email || !body.password) {
    return badRequest('email and password are required');
  }

  try {
    const userAttributes = [
      { Name: 'email', Value: body.email },
    ];

    if (body.name) {
      userAttributes.push({ Name: 'name', Value: body.name });
    }

    const result = await cognito.send(
      new SignUpCommand({
        ClientId: clientId,
        Username: body.email,
        Password: body.password,
        UserAttributes: userAttributes,
      })
    );

    return success({
      message: 'User registered. Check your email for a confirmation code.',
      userSub: result.UserSub,
      confirmed: result.UserConfirmed,
    }, 201);
  } catch (error: unknown) {
    const cognitoError = error as { name?: string; message?: string };

    if (cognitoError.name === 'UsernameExistsException') {
      return badRequest('An account with this email already exists');
    }
    if (cognitoError.name === 'InvalidPasswordException') {
      return badRequest(cognitoError.message ?? 'Password does not meet requirements');
    }

    console.error('Signup error:', error);
    return serverError('Failed to register user');
  }
};

import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type {
  APIGatewayRequestAuthorizerEventV2,
  APIGatewaySimpleAuthorizerWithContextResult,
} from 'aws-lambda';

interface AuthorizerContext {
  userId: string;
  email: string;
  groups: string;
}

const userPoolId = process.env.COGNITO_USER_POOL_ID ?? '';
const clientId = process.env.COGNITO_CLIENT_ID ?? '';

// Verifier is created once and reused across invocations (Lambda container reuse)
const verifier = userPoolId
  ? CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'access',
      clientId,
    })
  : null;

/**
 * Custom Lambda authorizer for JWT validation.
 * Used by serverless-offline for local dev. In production, the API Gateway V2
 * built-in JWT authorizer handles validation — this serves as a fallback
 * and for extracting user context in offline mode.
 */
export const handler = async (
  event: APIGatewayRequestAuthorizerEventV2
): Promise<APIGatewaySimpleAuthorizerWithContextResult<AuthorizerContext>> => {
  const token = event.headers?.authorization?.replace('Bearer ', '');

  if (!token) {
    return {
      isAuthorized: false,
      context: { userId: '', email: '', groups: '' },
    };
  }

  // In offline mode without a real Cognito pool, allow all tokens for dev
  if (process.env.IS_OFFLINE === 'true' && !userPoolId) {
    console.log('Offline mode: skipping JWT verification');
    return {
      isAuthorized: true,
      context: {
        userId: 'offline-user',
        email: 'dev@localhost',
        groups: 'admins',
      },
    };
  }

  if (!verifier) {
    console.error('No Cognito User Pool configured');
    return {
      isAuthorized: false,
      context: { userId: '', email: '', groups: '' },
    };
  }

  try {
    const payload = await verifier.verify(token);

    const groups = (payload['cognito:groups'] as string[] | undefined) ?? [];

    return {
      isAuthorized: true,
      context: {
        userId: payload.sub,
        email: (payload.email as string) ?? '',
        groups: groups.join(' '),
      },
    };
  } catch (error) {
    console.error('JWT verification failed:', error);
    return {
      isAuthorized: false,
      context: { userId: '', email: '', groups: '' },
    };
  }
};

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { success, unauthorized } from '../../lib/response';

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  // Extract user info from JWT claims (set by API Gateway JWT authorizer)
  const jwtContext = (
    event.requestContext as unknown as {
      authorizer?: { jwt?: { claims?: Record<string, string> } };
    }
  ).authorizer?.jwt?.claims;

  if (!jwtContext) {
    return unauthorized('No token claims found');
  }

  const groupsClaim = jwtContext['cognito:groups'] ?? '';
  const groups = groupsClaim
    ? groupsClaim.replace(/[[\]]/g, '').trim().split(/\s+/)
    : [];

  return success({
    userId: jwtContext.sub ?? '',
    email: jwtContext.email ?? '',
    name: jwtContext.name ?? '',
    emailVerified: jwtContext.email_verified === 'true',
    groups,
  });
};

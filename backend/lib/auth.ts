import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

export interface UserContext {
  userId: string;
  email: string;
  groups: string[];
}

/**
 * Extract user context from API Gateway V2 JWT authorizer claims.
 * The built-in JWT authorizer populates event.requestContext.authorizer.jwt.claims.
 */
export function getUserContext(event: APIGatewayProxyEventV2WithJWTAuthorizer): UserContext {
  const claims = event.requestContext.authorizer.jwt.claims;

  const userId = (claims.sub as string) ?? '';
  const email = (claims.email as string) ?? '';

  // cognito:groups comes as a string like "[admins]" or a space-separated list
  const groupsClaim = claims['cognito:groups'];
  let groups: string[] = [];

  if (typeof groupsClaim === 'string') {
    // Handle "[admins users]" format from Cognito
    const cleaned = groupsClaim.replace(/[[\]]/g, '').trim();
    groups = cleaned ? cleaned.split(/\s+/) : [];
  } else if (Array.isArray(groupsClaim)) {
    groups = groupsClaim as string[];
  }

  return { userId, email, groups };
}

/**
 * Check if the user is a member of the admins group.
 */
export function isAdmin(userContext: UserContext): boolean {
  return userContext.groups.includes('admins');
}

/**
 * Convenience: extract user context and verify admin membership.
 * Returns the user context if admin, null otherwise.
 */
export function requireAdmin(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): UserContext | null {
  const user = getUserContext(event);
  return isAdmin(user) ? user : null;
}

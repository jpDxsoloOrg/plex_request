import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider';

export const cognitoClient = new CognitoIdentityProviderClient({});

export interface VerifiedUser {
  userId: string;
  email: string;
}

function attributeValue(user: UserType, attributeName: string): string | undefined {
  return user.Attributes?.find((attribute) => attribute.Name === attributeName)?.Value;
}

function toVerifiedUser(user: UserType): VerifiedUser | null {
  const userId = attributeValue(user, 'sub');
  const email = attributeValue(user, 'email');
  const isUsable =
    user.UserStatus === 'CONFIRMED' &&
    user.Enabled !== false &&
    attributeValue(user, 'email_verified') === 'true';
  return isUsable && userId && email ? { userId, email } : null;
}

// The pool has case-sensitive usernames, so the comparison happens here rather
// than in a ListUsers filter. Two accounts differing only by case can't be told
// apart, so neither is returned.
export async function findVerifiedUserByEmail(email: string): Promise<VerifiedUser | null> {
  const wantedEmail = email.toLowerCase();
  const matches: VerifiedUser[] = [];

  let paginationToken: string | undefined;
  do {
    const page = await cognitoClient.send(new ListUsersCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Limit: 60,
      PaginationToken: paginationToken,
    }));
    for (const user of page.Users ?? []) {
      const verifiedUser = toVerifiedUser(user);
      if (verifiedUser?.email.toLowerCase() === wantedEmail) {
        matches.push(verifiedUser);
      }
    }
    paginationToken = page.PaginationToken;
  } while (paginationToken);

  return matches.length === 1 ? matches[0] : null;
}

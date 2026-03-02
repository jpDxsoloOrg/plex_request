import type { APIGatewayRequestAuthorizerEventV2, APIGatewaySimpleAuthorizerResult } from 'aws-lambda';

/**
 * JWT Authorizer stub — full implementation in Issue #15.
 * For now, serverless-offline will use the built-in JWT authorizer from API Gateway.
 */
export const handler = async (
  event: APIGatewayRequestAuthorizerEventV2
): Promise<APIGatewaySimpleAuthorizerResult> => {
  console.log('Authorizer invoked', event.headers?.authorization ? 'with token' : 'without token');

  return {
    isAuthorized: false,
  };
};

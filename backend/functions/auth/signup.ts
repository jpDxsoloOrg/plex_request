import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { success } from '../../lib/response';

/** Stub — full implementation in Issue #16 */
export const handler = async (
  _event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  return success({ message: 'signup endpoint — not yet implemented' });
};

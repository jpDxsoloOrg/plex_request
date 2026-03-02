import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { scan, SETTINGS_TABLE } from '../../../lib/dynamodb';
import { requireAdmin } from '../../../lib/auth';
import { success, forbidden, serverError } from '../../../lib/response';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const admin = requireAdmin(event);
  if (!admin) {
    return forbidden('Admin access required');
  }

  try {
    const settings = await scan({
      TableName: SETTINGS_TABLE,
    });

    // Return as a map keyed by settingKey for easy frontend consumption
    const settingsMap: Record<string, unknown> = {};
    for (const setting of settings) {
      const key = setting.settingKey as string;
      // Mask API keys in the response (show last 4 chars only)
      const apiKey = setting.apiKey as string | undefined;
      settingsMap[key] = {
        ...setting,
        apiKey: apiKey ? `${'*'.repeat(Math.max(0, apiKey.length - 4))}${apiKey.slice(-4)}` : '',
      };
    }

    return success({ settings: settingsMap });
  } catch (error) {
    console.error('Get settings error:', error);
    return serverError('Failed to get settings');
  }
};

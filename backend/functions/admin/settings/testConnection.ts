import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getItem, SETTINGS_TABLE } from '../../../lib/dynamodb';
import { requireAdmin } from '../../../lib/auth';
import { success, badRequest, forbidden } from '../../../lib/response';
import * as radarr from '../../../lib/integrations/radarr';
import * as sonarr from '../../../lib/integrations/sonarr';
import type { IntegrationSetting } from '../../../types';

const VALID_KEYS = ['radarr', 'sonarr', 'sabnzbd'];

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const admin = requireAdmin(event);
  if (!admin) {
    return forbidden('Admin access required');
  }

  const key = event.pathParameters?.key;
  if (!key || !VALID_KEYS.includes(key)) {
    return badRequest(`Invalid setting key. Must be one of: ${VALID_KEYS.join(', ')}`);
  }

  try {
    // Allow testing with body params (for testing before saving) or from stored settings
    let baseUrl: string;
    let apiKey: string;

    if (event.body) {
      const body = JSON.parse(event.body) as { baseUrl?: string; apiKey?: string };
      baseUrl = body.baseUrl ?? '';
      apiKey = body.apiKey ?? '';
    } else {
      const setting = await getItem({
        TableName: SETTINGS_TABLE,
        Key: { settingKey: key },
      }) as IntegrationSetting | undefined;

      if (!setting) {
        return badRequest(`${key} is not configured`);
      }
      baseUrl = setting.baseUrl;
      apiKey = setting.apiKey;
    }

    if (!baseUrl || !apiKey) {
      return badRequest('baseUrl and apiKey are required');
    }

    const config = { baseUrl, apiKey };

    if (key === 'radarr') {
      const status = await radarr.testConnection(config);
      return success({ connected: true, service: 'radarr', version: status.version });
    }

    if (key === 'sonarr') {
      const status = await sonarr.testConnection(config);
      return success({ connected: true, service: 'sonarr', version: status.version });
    }

    // SABnzbd — will be implemented in stretch goal
    return badRequest(`Test connection not yet implemented for ${key}`);
  } catch (error) {
    console.error(`Test connection error for ${key}:`, error);
    const message = error instanceof Error ? error.message : 'Connection failed';
    return success({ connected: false, service: key, error: message });
  }
};

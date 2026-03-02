import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { putItem, SETTINGS_TABLE } from '../../../lib/dynamodb';
import { requireAdmin } from '../../../lib/auth';
import { success, badRequest, forbidden, serverError } from '../../../lib/response';
import type { IntegrationSetting } from '../../../types';

const VALID_KEYS = ['radarr', 'sonarr', 'sabnzbd'];

interface UpdateSettingBody {
  baseUrl: string;
  apiKey: string;
  qualityProfileId?: number;
  rootFolderPath?: string;
  enabled: boolean;
}

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

  if (!event.body) {
    return badRequest('Request body is required');
  }

  const body = JSON.parse(event.body) as UpdateSettingBody;

  if (!body.baseUrl) {
    return badRequest('baseUrl is required');
  }

  try {
    const setting: IntegrationSetting = {
      settingKey: key,
      baseUrl: body.baseUrl.replace(/\/+$/, ''), // strip trailing slashes
      apiKey: body.apiKey ?? '',
      qualityProfileId: body.qualityProfileId,
      rootFolderPath: body.rootFolderPath,
      enabled: body.enabled ?? true,
    };

    await putItem({
      TableName: SETTINGS_TABLE,
      Item: setting,
    });

    return success({
      ...setting,
      apiKey: setting.apiKey
        ? `${'*'.repeat(Math.max(0, setting.apiKey.length - 4))}${setting.apiKey.slice(-4)}`
        : '',
    });
  } catch (error) {
    console.error('Update setting error:', error);
    return serverError('Failed to update setting');
  }
};

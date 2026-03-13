import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getItem, SETTINGS_TABLE } from '../../../lib/dynamodb';
import { requireAdmin } from '../../../lib/auth';
import { success, badRequest, forbidden, serverError } from '../../../lib/response';
import * as radarr from '../../../lib/integrations/radarr';
import * as sonarr from '../../../lib/integrations/sonarr';
import type { IntegrationSetting } from '../../../types';

const VALID_KEYS = ['radarr', 'sonarr'];

async function getConfig(key: string) {
  const setting = await getItem({
    TableName: SETTINGS_TABLE,
    Key: { settingKey: key },
  }) as IntegrationSetting | undefined;

  if (setting?.baseUrl && setting.apiKey) {
    return { baseUrl: setting.baseUrl, apiKey: setting.apiKey };
  }

  const prefix = key.toUpperCase();
  return {
    baseUrl: process.env[`${prefix}_BASE_URL`] ?? '',
    apiKey: process.env[`${prefix}_API_KEY`] ?? '',
  };
}

export const profilesHandler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const admin = requireAdmin(event);
  if (!admin) return forbidden('Admin access required');

  const key = event.pathParameters?.key;
  if (!key || !VALID_KEYS.includes(key)) {
    return badRequest(`Invalid key. Must be one of: ${VALID_KEYS.join(', ')}`);
  }

  try {
    const config = await getConfig(key);
    if (!config.baseUrl || !config.apiKey) {
      return badRequest(`${key} is not configured`);
    }

    const profiles = key === 'radarr'
      ? await radarr.getQualityProfiles(config)
      : await sonarr.getQualityProfiles(config);

    return success(profiles);
  } catch (error) {
    console.error(`Get profiles error for ${key}:`, error);
    return serverError('Failed to fetch quality profiles');
  }
};

export const languageProfilesHandler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const admin = requireAdmin(event);
  if (!admin) return forbidden('Admin access required');

  const key = event.pathParameters?.key;
  if (key !== 'sonarr') {
    return badRequest('Language profiles are only available for Sonarr');
  }

  try {
    const config = await getConfig(key);
    if (!config.baseUrl || !config.apiKey) {
      return badRequest('sonarr is not configured');
    }

    const profiles = await sonarr.getLanguageProfiles(config);
    return success(profiles);
  } catch (error) {
    console.error('Get language profiles error:', error);
    return serverError('Failed to fetch language profiles');
  }
};

export const foldersHandler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const admin = requireAdmin(event);
  if (!admin) return forbidden('Admin access required');

  const key = event.pathParameters?.key;
  if (!key || !VALID_KEYS.includes(key)) {
    return badRequest(`Invalid key. Must be one of: ${VALID_KEYS.join(', ')}`);
  }

  try {
    const config = await getConfig(key);
    if (!config.baseUrl || !config.apiKey) {
      return badRequest(`${key} is not configured`);
    }

    const folders = key === 'radarr'
      ? await radarr.getRootFolders(config)
      : await sonarr.getRootFolders(config);

    return success(folders);
  } catch (error) {
    console.error(`Get folders error for ${key}:`, error);
    return serverError('Failed to fetch root folders');
  }
};

import { getItem, SETTINGS_TABLE } from './dynamodb';
import type { IntegrationSetting } from '../types';

export async function getServiceSetting(key: string): Promise<IntegrationSetting> {
  const setting = await getItem({
    TableName: SETTINGS_TABLE,
    Key: { settingKey: key },
  }) as IntegrationSetting | undefined;

  if (setting?.baseUrl && setting.apiKey) {
    return setting;
  }

  const prefix = key.toUpperCase();
  const baseUrl = process.env[`${prefix}_BASE_URL`] ?? '';
  const apiKey = process.env[`${prefix}_API_KEY`] ?? '';

  return {
    settingKey: key,
    baseUrl,
    apiKey,
    enabled: !!(baseUrl && apiKey),
    qualityProfileId: setting?.qualityProfileId,
    rootFolderPath: setting?.rootFolderPath,
  };
}

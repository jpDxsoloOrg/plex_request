import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getItem, SETTINGS_TABLE } from '../../lib/dynamodb';
import { success, badRequest, serverError } from '../../lib/response';
import type { IntegrationSetting } from '../../types';

interface SonarrEpisode {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  hasFile: boolean;
}

async function getSonarrConfig(): Promise<{ baseUrl: string; apiKey: string }> {
  const setting = await getItem({
    TableName: SETTINGS_TABLE,
    Key: { settingKey: 'sonarr' },
  }) as IntegrationSetting | undefined;

  if (setting?.baseUrl && setting.apiKey) {
    return { baseUrl: setting.baseUrl, apiKey: setting.apiKey };
  }

  return {
    baseUrl: process.env.SONARR_BASE_URL ?? '',
    apiKey: process.env.SONARR_API_KEY ?? '',
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const sonarrId = event.queryStringParameters?.sonarrId;
  if (!sonarrId) {
    return badRequest('sonarrId query parameter is required');
  }

  try {
    const config = await getSonarrConfig();
    if (!config.baseUrl || !config.apiKey) {
      return serverError('Sonarr is not configured');
    }

    const response = await fetch(
      `${config.baseUrl}/api/v3/episode?seriesId=${encodeURIComponent(sonarrId)}`,
      { headers: { 'X-Api-Key': config.apiKey } }
    );

    if (!response.ok) {
      throw new Error(`Sonarr responded with ${response.status}`);
    }

    const episodes = await response.json() as SonarrEpisode[];

    const normalized = episodes.map((ep) => ({
      seasonNumber: ep.seasonNumber,
      episodeNumber: ep.episodeNumber,
      title: ep.title,
      hasFile: ep.hasFile,
    }));

    return success(normalized);
  } catch (error) {
    console.error('Get episodes error:', error);
    return serverError('Failed to fetch episodes');
  }
};

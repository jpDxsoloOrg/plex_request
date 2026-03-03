import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getItem, SETTINGS_TABLE } from '../../lib/dynamodb';
import { success, badRequest, serverError } from '../../lib/response';
import * as sonarr from '../../lib/integrations/sonarr';
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
  const tvdbId = event.queryStringParameters?.tvdbId ?? event.queryStringParameters?.sonarrId;
  if (!tvdbId) {
    return badRequest('tvdbId query parameter is required');
  }

  try {
    const config = await getSonarrConfig();
    if (!config.baseUrl || !config.apiKey) {
      return serverError('Sonarr is not configured');
    }

    // Find the Sonarr internal series ID by matching tvdbId
    const allSeries = await sonarr.getAllSeries(config);
    const series = allSeries.find((s) => s.tvdbId === Number(tvdbId));
    if (!series) {
      return success([]);
    }

    const response = await fetch(
      `${config.baseUrl}/api/v3/episode?seriesId=${series.id}`,
      { headers: { 'X-Api-Key': config.apiKey } }
    );

    if (!response.ok) {
      throw new Error(`Sonarr responded with ${response.status}`);
    }

    const episodes = await response.json() as SonarrEpisode[];

    const normalized = episodes
      .filter((ep) => ep.seasonNumber > 0)
      .map((ep) => ({
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

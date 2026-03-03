import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getItem, SETTINGS_TABLE } from '../../lib/dynamodb';
import { success, badRequest } from '../../lib/response';
import * as radarr from '../../lib/integrations/radarr';
import * as sonarr from '../../lib/integrations/sonarr';
import type { IntegrationSetting } from '../../types';

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

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const tmdbId = event.queryStringParameters?.tmdbId;
  const mediaType = event.queryStringParameters?.mediaType;

  if (!tmdbId || !mediaType) {
    return badRequest('tmdbId and mediaType are required');
  }

  try {
    if (mediaType === 'movie') {
      const config = await getConfig('radarr');
      if (!config.baseUrl || !config.apiKey) {
        return success({ exists: false });
      }

      const movies = await radarr.getMoviesByTmdbId(config, Number(tmdbId));
      if (movies.length > 0) {
        const movie = movies[0];
        return success({
          exists: true,
          hasFile: movie.hasFile ?? false,
          message: movie.hasFile
            ? 'This movie is already available in your library.'
            : 'This movie is already being monitored and will be available soon.',
        });
      }
    }

    if (mediaType === 'tv') {
      const config = await getConfig('sonarr');
      if (!config.baseUrl || !config.apiKey) {
        return success({ exists: false });
      }

      const allSeries = await sonarr.getAllSeries(config);
      // The search API returns tvdbId as the id for TV shows,
      // so we can match directly against Sonarr's series list
      const tvdbId = Number(tmdbId);
      const existing = allSeries.find((s) => s.tvdbId === tvdbId);
      if (existing) {
        return success({
          exists: true,
          hasFile: false,
          message: 'This show is already being monitored in your library.',
        });
      }
    }

    return success({ exists: false });
  } catch (error) {
    console.error('Check media error:', error);
    // Don't block the user if the check fails — just return not found
    return success({ exists: false });
  }
};

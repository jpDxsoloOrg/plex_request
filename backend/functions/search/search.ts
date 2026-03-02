import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { success, badRequest, serverError } from '../../lib/response';
import { getItem, SETTINGS_TABLE } from '../../lib/dynamodb';
import type { IntegrationSetting, MediaType } from '../../types';

interface SearchResult {
  id: number;
  title: string;
  year: string;
  overview: string;
  posterUrl: string;
  mediaType: MediaType;
}

async function getServiceConfig(key: string): Promise<{ baseUrl: string; apiKey: string }> {
  // Try Settings table first, fall back to env vars
  const setting = await getItem({
    TableName: SETTINGS_TABLE,
    Key: { settingKey: key },
  }) as IntegrationSetting | undefined;

  if (setting?.baseUrl && setting.apiKey) {
    return { baseUrl: setting.baseUrl, apiKey: setting.apiKey };
  }

  const envPrefix = key.toUpperCase();
  return {
    baseUrl: process.env[`${envPrefix}_BASE_URL`] ?? '',
    apiKey: process.env[`${envPrefix}_API_KEY`] ?? '',
  };
}

async function searchRadarr(query: string, baseUrl: string, apiKey: string): Promise<SearchResult[]> {
  const url = `${baseUrl}/api/v3/movie/lookup?term=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { 'X-Api-Key': apiKey },
  });

  if (!response.ok) {
    throw new Error(`Radarr responded with ${response.status}`);
  }

  const movies = await response.json() as Array<{
    tmdbId: number;
    title: string;
    year: number;
    overview: string;
    remotePoster?: string;
    images?: Array<{ coverType: string; remoteUrl: string }>;
  }>;

  return movies.map((movie) => ({
    id: movie.tmdbId,
    title: movie.title,
    year: String(movie.year),
    overview: movie.overview ?? '',
    posterUrl: movie.remotePoster ?? movie.images?.find((img) => img.coverType === 'poster')?.remoteUrl ?? '',
    mediaType: 'movie' as const,
  }));
}

async function searchSonarr(query: string, baseUrl: string, apiKey: string): Promise<SearchResult[]> {
  const url = `${baseUrl}/api/v3/series/lookup?term=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { 'X-Api-Key': apiKey },
  });

  if (!response.ok) {
    throw new Error(`Sonarr responded with ${response.status}`);
  }

  const series = await response.json() as Array<{
    tvdbId: number;
    title: string;
    year: number;
    overview: string;
    remotePoster?: string;
    images?: Array<{ coverType: string; remoteUrl: string }>;
  }>;

  return series.map((show) => ({
    id: show.tvdbId,
    title: show.title,
    year: String(show.year),
    overview: show.overview ?? '',
    posterUrl: show.remotePoster ?? show.images?.find((img) => img.coverType === 'poster')?.remoteUrl ?? '',
    mediaType: 'tv' as const,
  }));
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const query = event.queryStringParameters?.query;
  const type = (event.queryStringParameters?.type ?? 'movie') as MediaType;

  if (!query) {
    return badRequest('query parameter is required');
  }

  if (type !== 'movie' && type !== 'tv') {
    return badRequest('type must be "movie" or "tv"');
  }

  try {
    const serviceKey = type === 'movie' ? 'radarr' : 'sonarr';
    const config = await getServiceConfig(serviceKey);

    if (!config.baseUrl || !config.apiKey) {
      return serverError(`${serviceKey} is not configured. Please set up the connection in admin settings.`);
    }

    const results = type === 'movie'
      ? await searchRadarr(query, config.baseUrl, config.apiKey)
      : await searchSonarr(query, config.baseUrl, config.apiKey);

    return success({ results, total: results.length });
  } catch (error) {
    console.error('Search error:', error);
    return serverError('Search failed. The media service may be unreachable.');
  }
};

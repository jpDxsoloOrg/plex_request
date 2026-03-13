import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { success, badRequest, serverError } from '../../lib/response';
import { getServiceSetting } from '../../lib/settings';
import * as sonarr from '../../lib/integrations/sonarr';
import type { LibraryEpisode } from '../../types';

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const sonarrId = parseInt(event.pathParameters?.sonarrId ?? '', 10);
    if (isNaN(sonarrId)) {
      return badRequest('Invalid sonarrId');
    }

    const seasonNumber = event.queryStringParameters?.seasonNumber
      ? parseInt(event.queryStringParameters.seasonNumber, 10)
      : undefined;

    const setting = await getServiceSetting('sonarr');
    if (!setting.enabled || !setting.baseUrl || !setting.apiKey) {
      return success({ episodes: [] });
    }

    const config = { baseUrl: setting.baseUrl, apiKey: setting.apiKey };
    const allEpisodes = await sonarr.getEpisodes(config, sonarrId);

    let episodes: LibraryEpisode[] = allEpisodes.map((ep) => ({
      episodeId: ep.id,
      seasonNumber: ep.seasonNumber,
      episodeNumber: ep.episodeNumber,
      title: ep.title,
      airDate: ep.airDate,
      overview: ep.overview ?? '',
      hasFile: ep.hasFile,
      monitored: ep.monitored,
    }));

    if (seasonNumber !== undefined) {
      episodes = episodes.filter((ep) => ep.seasonNumber === seasonNumber);
    }

    episodes.sort((a, b) =>
      a.seasonNumber !== b.seasonNumber
        ? a.seasonNumber - b.seasonNumber
        : a.episodeNumber - b.episodeNumber
    );

    return success({ episodes });
  } catch (error) {
    console.error('Library episodes error:', error);
    return serverError('Failed to fetch episodes');
  }
};

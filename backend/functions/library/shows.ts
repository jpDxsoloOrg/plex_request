import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { success, serverError } from '../../lib/response';
import { getServiceSetting } from '../../lib/settings';
import * as sonarr from '../../lib/integrations/sonarr';
import type { LibraryShow, LibraryShowSeason } from '../../types';

function getShowStatus(episodeFileCount: number, episodeCount: number): 'downloaded' | 'partial' | 'missing' {
  if (episodeCount === 0) return 'missing';
  if (episodeFileCount >= episodeCount) return 'downloaded';
  if (episodeFileCount > 0) return 'partial';
  return 'missing';
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const searchTerm = event.queryStringParameters?.search?.toLowerCase();
    const statusFilter = event.queryStringParameters?.status ?? 'all';
    const page = Math.max(1, parseInt(event.queryStringParameters?.page ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(event.queryStringParameters?.pageSize ?? '48', 10)));

    const setting = await getServiceSetting('sonarr');
    if (!setting.enabled || !setting.baseUrl || !setting.apiKey) {
      return success({ shows: [], total: 0, page, pageSize });
    }

    const config = { baseUrl: setting.baseUrl, apiKey: setting.apiKey };
    const allSeries = await sonarr.getAllSeries(config);

    let shows: LibraryShow[] = allSeries.map((s) => {
      const poster = s.images?.find((img) => img.coverType === 'poster');
      const stats = s.statistics;
      const episodeFileCount = stats?.episodeFileCount ?? 0;
      const episodeCount = stats?.episodeCount ?? 0;
      const totalEpisodeCount = stats?.totalEpisodeCount ?? 0;

      const seasons: LibraryShowSeason[] = (s.seasons ?? [])
        .filter((season) => season.seasonNumber > 0)
        .map((season) => ({
          seasonNumber: season.seasonNumber,
          monitored: season.monitored,
          episodeFileCount: season.statistics?.episodeFileCount ?? 0,
          episodeCount: season.statistics?.episodeCount ?? 0,
          totalEpisodeCount: season.statistics?.totalEpisodeCount ?? 0,
          percentComplete: season.statistics?.percentOfEpisodes ?? 0,
        }));

      return {
        sonarrId: s.id,
        tvdbId: s.tvdbId,
        title: s.title,
        year: s.year,
        posterUrl: poster?.remoteUrl ?? s.remotePoster ?? '',
        status: getShowStatus(episodeFileCount, episodeCount),
        monitored: s.monitored ?? false,
        episodeFileCount,
        episodeCount,
        totalEpisodeCount,
        sizeOnDisk: stats?.sizeOnDisk ?? 0,
        percentComplete: stats?.percentOfEpisodes ?? 0,
        seasons,
      };
    });

    if (searchTerm) {
      shows = shows.filter((s) => s.title.toLowerCase().includes(searchTerm));
    }

    if (statusFilter !== 'all') {
      shows = shows.filter((s) => s.status === statusFilter);
    }

    shows.sort((a, b) => a.title.localeCompare(b.title));

    const total = shows.length;
    const start = (page - 1) * pageSize;
    const paged = shows.slice(start, start + pageSize);

    return success({ shows: paged, total, page, pageSize });
  } catch (error) {
    console.error('Library shows error:', error);
    return serverError('Failed to fetch library shows');
  }
};

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { success, serverError } from '../../lib/response';
import { getServiceSetting } from '../../lib/settings';
import * as radarr from '../../lib/integrations/radarr';
import type { LibraryMovie } from '../../types';

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const searchTerm = event.queryStringParameters?.search?.toLowerCase();
    const statusFilter = event.queryStringParameters?.status ?? 'all';
    const page = Math.max(1, parseInt(event.queryStringParameters?.page ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(event.queryStringParameters?.pageSize ?? '48', 10)));

    const setting = await getServiceSetting('radarr');
    if (!setting.enabled || !setting.baseUrl || !setting.apiKey) {
      return success({ movies: [], total: 0, page, pageSize });
    }

    const config = { baseUrl: setting.baseUrl, apiKey: setting.apiKey };
    const allMovies = await radarr.getAllMovies(config);

    let movies: LibraryMovie[] = allMovies.map((m) => {
      const poster = m.images?.find((img) => img.coverType === 'poster');
      return {
        radarrId: m.id,
        tmdbId: m.tmdbId,
        title: m.title,
        year: m.year,
        posterUrl: poster?.remoteUrl ?? m.remotePoster ?? '',
        status: m.hasFile ? 'downloaded' as const : 'missing' as const,
        sizeOnDisk: m.sizeOnDisk ?? 0,
        monitored: m.monitored ?? false,
      };
    });

    if (searchTerm) {
      movies = movies.filter((m) => m.title.toLowerCase().includes(searchTerm));
    }

    if (statusFilter === 'downloaded') {
      movies = movies.filter((m) => m.status === 'downloaded');
    } else if (statusFilter === 'missing') {
      movies = movies.filter((m) => m.status === 'missing');
    }

    movies.sort((a, b) => a.title.localeCompare(b.title));

    const total = movies.length;
    const start = (page - 1) * pageSize;
    const paged = movies.slice(start, start + pageSize);

    return success({ movies: paged, total, page, pageSize });
  } catch (error) {
    console.error('Library movies error:', error);
    return serverError('Failed to fetch library movies');
  }
};

import { scan, updateItem, REQUESTS_TABLE } from '../../lib/dynamodb';
import { getServiceSetting } from '../../lib/settings';
import * as radarr from '../../lib/integrations/radarr';
import * as sonarr from '../../lib/integrations/sonarr';
import type { MediaRequest } from '../../types';

export const handler = async (): Promise<void> => {
  try {
    const allRequests = await scan({ TableName: REQUESTS_TABLE }) as MediaRequest[];
    const activeRequests = allRequests.filter(
      (r) => r.status === 'approved' || r.status === 'downloading'
    );

    if (activeRequests.length === 0) return;

    const movieRequests = activeRequests.filter((r) => r.mediaType === 'movie' && r.radarrId);
    const tvRequests = activeRequests.filter((r) => r.mediaType === 'tv' && r.sonarrId);

    const [radarrSetting, sonarrSetting] = await Promise.all([
      movieRequests.length > 0 ? getServiceSetting('radarr') : null,
      tvRequests.length > 0 ? getServiceSetting('sonarr') : null,
    ]);

    // Fetch queues
    const [radarrQueue, sonarrQueue] = await Promise.all([
      radarrSetting?.enabled
        ? radarr.getQueue({ baseUrl: radarrSetting.baseUrl, apiKey: radarrSetting.apiKey }).catch(() => [])
        : [],
      sonarrSetting?.enabled
        ? sonarr.getQueue({ baseUrl: sonarrSetting.baseUrl, apiKey: sonarrSetting.apiKey }).catch(() => [])
        : [],
    ]);

    const updates: Promise<unknown>[] = [];

    // Check movies
    for (const req of movieRequests) {
      const inQueue = radarrQueue.some((q) => q.movieId === req.radarrId);

      if (inQueue && req.status === 'approved') {
        updates.push(setRequestStatus(req.requestId, 'downloading'));
      } else if (!inQueue && radarrSetting?.enabled) {
        try {
          const config = { baseUrl: radarrSetting.baseUrl, apiKey: radarrSetting.apiKey };
          const movie = await radarr.getMovie(config, req.radarrId!);
          if (movie.hasFile) {
            updates.push(setRequestStatus(req.requestId, 'complete'));
          }
        } catch {
          // Skip if we can't reach Radarr
        }
      }
    }

    // Check TV shows
    for (const req of tvRequests) {
      const inQueue = sonarrQueue.some((q) => q.seriesId === req.sonarrId);

      if (inQueue && req.status === 'approved') {
        updates.push(setRequestStatus(req.requestId, 'downloading'));
      } else if (!inQueue && sonarrSetting?.enabled) {
        try {
          const config = { baseUrl: sonarrSetting.baseUrl, apiKey: sonarrSetting.apiKey };
          const series = await sonarr.getSeries(config, req.sonarrId!);
          const fileCount = series.statistics?.episodeFileCount ?? 0;
          const totalCount = series.statistics?.episodeCount ?? 1;
          if (fileCount >= totalCount) {
            updates.push(setRequestStatus(req.requestId, 'complete'));
          }
        } catch {
          // Skip if we can't reach Sonarr
        }
      }
    }

    await Promise.all(updates);
    console.log(`Sync complete: processed ${activeRequests.length} requests, ${updates.length} status updates`);
  } catch (error) {
    console.error('Sync status error:', error);
  }
};

async function setRequestStatus(requestId: string, status: string): Promise<void> {
  await updateItem({
    TableName: REQUESTS_TABLE,
    Key: { requestId },
    UpdateExpression: 'SET #status = :status, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': status,
      ':now': new Date().toISOString(),
    },
  });
}

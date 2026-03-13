import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { query, REQUESTS_TABLE } from '../../lib/dynamodb';
import { getUserContext } from '../../lib/auth';
import { success, serverError } from '../../lib/response';
import { getServiceSetting } from '../../lib/settings';
import * as radarr from '../../lib/integrations/radarr';
import * as sonarr from '../../lib/integrations/sonarr';
import type { MediaRequest, DownloadStatus } from '../../types';

async function buildDownloadStatuses(requests: MediaRequest[]): Promise<Record<string, DownloadStatus>> {
  const statuses: Record<string, DownloadStatus> = {};

  const movieRequests = requests.filter((r) => r.mediaType === 'movie' && r.radarrId);
  const tvRequests = requests.filter((r) => r.mediaType === 'tv' && r.sonarrId);

  const [radarrSetting, sonarrSetting] = await Promise.all([
    movieRequests.length > 0 ? getServiceSetting('radarr') : null,
    tvRequests.length > 0 ? getServiceSetting('sonarr') : null,
  ]);

  // Fetch queues in parallel
  const [radarrQueue, sonarrQueue] = await Promise.all([
    radarrSetting?.enabled
      ? radarr.getQueue({ baseUrl: radarrSetting.baseUrl, apiKey: radarrSetting.apiKey }).catch(() => [])
      : [],
    sonarrSetting?.enabled
      ? sonarr.getQueue({ baseUrl: sonarrSetting.baseUrl, apiKey: sonarrSetting.apiKey }).catch(() => [])
      : [],
  ]);

  // Build movie statuses
  for (const req of movieRequests) {
    const queueItem = radarrQueue.find((q) => q.movieId === req.radarrId);
    if (queueItem) {
      const percent = queueItem.size > 0
        ? Math.round(((queueItem.size - queueItem.sizeleft) / queueItem.size) * 100)
        : 0;
      statuses[req.requestId] = {
        requestId: req.requestId,
        downloadState: mapQueueStatus(queueItem.status, queueItem.trackedDownloadState),
        percentComplete: percent,
        sizeTotal: queueItem.size,
        sizeRemaining: queueItem.sizeleft,
        estimatedCompletion: queueItem.estimatedCompletionTime || undefined,
        downloadClient: queueItem.downloadClient || undefined,
      };
    } else if (radarrSetting?.enabled) {
      // Not in queue — check if file exists
      try {
        const config = { baseUrl: radarrSetting.baseUrl, apiKey: radarrSetting.apiKey };
        const movie = await radarr.getMovie(config, req.radarrId!);
        statuses[req.requestId] = {
          requestId: req.requestId,
          downloadState: movie.hasFile ? 'completed' : 'pending',
          percentComplete: movie.hasFile ? 100 : 0,
        };
      } catch {
        statuses[req.requestId] = {
          requestId: req.requestId,
          downloadState: 'pending',
          percentComplete: 0,
        };
      }
    }
  }

  // Build TV statuses
  for (const req of tvRequests) {
    const queueItems = sonarrQueue.filter((q) => q.seriesId === req.sonarrId);
    if (queueItems.length > 0) {
      // Use the first actively downloading item for progress
      const activeItem = queueItems[0];
      const percent = activeItem.size > 0
        ? Math.round(((activeItem.size - activeItem.sizeleft) / activeItem.size) * 100)
        : 0;
      statuses[req.requestId] = {
        requestId: req.requestId,
        downloadState: mapQueueStatus(activeItem.status, activeItem.trackedDownloadState),
        percentComplete: percent,
        sizeTotal: activeItem.size,
        sizeRemaining: activeItem.sizeleft,
        estimatedCompletion: activeItem.estimatedCompletionTime || undefined,
        downloadClient: activeItem.downloadClient || undefined,
      };
    } else if (sonarrSetting?.enabled) {
      try {
        const config = { baseUrl: sonarrSetting.baseUrl, apiKey: sonarrSetting.apiKey };
        const series = await sonarr.getSeries(config, req.sonarrId!);
        const fileCount = series.statistics?.episodeFileCount ?? 0;
        const totalCount = series.statistics?.episodeCount ?? 1;
        const allDownloaded = fileCount >= totalCount;
        statuses[req.requestId] = {
          requestId: req.requestId,
          downloadState: allDownloaded ? 'completed' : 'pending',
          percentComplete: totalCount > 0 ? Math.round((fileCount / totalCount) * 100) : 0,
        };
      } catch {
        statuses[req.requestId] = {
          requestId: req.requestId,
          downloadState: 'pending',
          percentComplete: 0,
        };
      }
    }
  }

  return statuses;
}

function mapQueueStatus(status: string, trackedState: string): DownloadStatus['downloadState'] {
  if (trackedState === 'downloading') return 'downloading';
  if (trackedState === 'importPending' || trackedState === 'importing') return 'importing';
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  if (status === 'warning') return 'warning';
  if (status === 'queued' || status === 'delay') return 'queued';
  return 'downloading';
}

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const user = getUserContext(event);

    // Get user's approved/downloading requests
    const items = await query({
      TableName: REQUESTS_TABLE,
      IndexName: 'UserIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': user.userId },
    }) as MediaRequest[];

    const activeRequests = items.filter(
      (r) => r.status === 'approved' || r.status === 'downloading'
    );

    if (activeRequests.length === 0) {
      return success({ statuses: {} });
    }

    const statuses = await buildDownloadStatuses(activeRequests);
    return success({ statuses });
  } catch (error) {
    console.error('Download status error:', error);
    return serverError('Failed to fetch download status');
  }
};

export { buildDownloadStatuses };

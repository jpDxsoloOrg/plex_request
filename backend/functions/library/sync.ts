import type { ScheduledEvent } from 'aws-lambda';
import { getItem, batchWrite, scan, deleteItem, SETTINGS_TABLE, LIBRARY_TABLE } from '../../lib/dynamodb';
import * as radarr from '../../lib/integrations/radarr';
import * as sonarr from '../../lib/integrations/sonarr';
import type { IntegrationSetting } from '../../types';

async function getConfig(key: string): Promise<{ baseUrl: string; apiKey: string } | null> {
  const setting = await getItem({
    TableName: SETTINGS_TABLE,
    Key: { settingKey: key },
  }) as IntegrationSetting | undefined;

  const baseUrl = setting?.baseUrl || process.env[`${key.toUpperCase()}_BASE_URL`] || '';
  const apiKey = setting?.apiKey || process.env[`${key.toUpperCase()}_API_KEY`] || '';
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export const handler = async (_event: ScheduledEvent): Promise<void> => {
  const ttl = Math.floor(Date.now() / 1000) + 7200;
  const now = new Date().toISOString();
  const syncedPks = new Set<string>();
  let movieCount = 0;
  let seriesCount = 0;

  // Sync Radarr movies
  const radarrConfig = await getConfig('radarr');
  if (radarrConfig) {
    try {
      const movies = await radarr.getAllMovies(radarrConfig);
      movieCount = movies.length;
      const items = movies.map((m) => ({
        PutRequest: {
          Item: {
            pk: `movie#${m.tmdbId}`,
            mediaType: 'movie',
            title: m.title,
            year: m.year,
            tmdbId: m.tmdbId,
            radarrId: m.id,
            hasFile: m.hasFile ?? false,
            syncedAt: now,
            ttl,
          },
        },
      }));
      for (const chunk of chunks(items, 25)) {
        await batchWrite({ RequestItems: { [LIBRARY_TABLE]: chunk } });
      }
      for (const m of movies) {
        syncedPks.add(`movie#${m.tmdbId}`);
      }
    } catch (error) {
      console.error('Radarr sync failed:', error);
    }
  }

  // Sync Sonarr series
  const sonarrConfig = await getConfig('sonarr');
  if (sonarrConfig) {
    try {
      const series = await sonarr.getAllSeries(sonarrConfig);
      seriesCount = series.length;
      const items = series.map((s) => ({
        PutRequest: {
          Item: {
            pk: `tv#${s.tvdbId}`,
            mediaType: 'tv',
            title: s.title,
            year: s.year,
            tvdbId: s.tvdbId,
            sonarrId: s.id,
            hasFile: false,
            syncedAt: now,
            ttl,
          },
        },
      }));
      for (const chunk of chunks(items, 25)) {
        await batchWrite({ RequestItems: { [LIBRARY_TABLE]: chunk } });
      }
      for (const s of series) {
        syncedPks.add(`tv#${s.tvdbId}`);
      }
    } catch (error) {
      console.error('Sonarr sync failed:', error);
    }
  }

  // Purge stale records no longer in either library
  if (syncedPks.size > 0) {
    try {
      const existing = await scan({ TableName: LIBRARY_TABLE });
      const stale = existing.filter((item) => !syncedPks.has(item.pk as string));
      for (const item of stale) {
        await deleteItem({ TableName: LIBRARY_TABLE, Key: { pk: item.pk } });
      }
      console.log(`Library sync complete. Movies: ${movieCount}, Series: ${seriesCount}, Stale purged: ${stale.length}`);
    } catch (error) {
      console.error('Stale purge failed:', error);
    }
  } else {
    console.log('Library sync: no services configured, nothing to sync');
  }
};

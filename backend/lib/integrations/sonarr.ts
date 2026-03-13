interface SonarrConfig {
  baseUrl: string;
  apiKey: string;
}

interface SonarrSeasonStatistics {
  episodeFileCount: number;
  episodeCount: number;
  totalEpisodeCount: number;
  sizeOnDisk: number;
  percentOfEpisodes: number;
}

interface SonarrSeriesStatistics {
  seasonCount: number;
  episodeFileCount: number;
  episodeCount: number;
  totalEpisodeCount: number;
  sizeOnDisk: number;
  percentOfEpisodes: number;
}

interface SonarrSeries {
  id: number;
  tvdbId: number;
  title: string;
  year: number;
  overview: string;
  remotePoster?: string;
  images?: Array<{ coverType: string; remoteUrl: string }>;
  path?: string;
  qualityProfileId?: number;
  rootFolderPath?: string;
  monitored?: boolean;
  seasonFolder?: boolean;
  seasons?: Array<{
    seasonNumber: number;
    monitored: boolean;
    statistics?: SonarrSeasonStatistics;
  }>;
  statistics?: SonarrSeriesStatistics;
}

export interface SonarrEpisode {
  id: number;
  seriesId: number;
  tvdbId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate: string;
  airDateUtc: string;
  overview: string;
  hasFile: boolean;
  monitored: boolean;
}

interface SonarrQueueItem {
  id: number;
  seriesId: number;
  episodeId: number;
  title: string;
  status: string;
  trackedDownloadStatus: string;
  trackedDownloadState: string;
  size: number;
  sizeleft: number;
  timeleft: string;
  estimatedCompletionTime: string;
  downloadClient: string;
}

interface SonarrQueueResponse {
  page: number;
  pageSize: number;
  totalRecords: number;
  records: SonarrQueueItem[];
}

interface QualityProfile {
  id: number;
  name: string;
}

interface RootFolder {
  id: number;
  path: string;
  freeSpace: number;
}

interface SystemStatus {
  version: string;
  appName: string;
}

async function sonarrFetch<T>(config: SonarrConfig, path: string, options?: RequestInit): Promise<T> {
  const url = `${config.baseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Api-Key': config.apiKey,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sonarr API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

export async function testConnection(config: SonarrConfig): Promise<SystemStatus> {
  return sonarrFetch<SystemStatus>(config, '/api/v3/system/status');
}

export async function lookupSeries(config: SonarrConfig, term: string): Promise<SonarrSeries[]> {
  return sonarrFetch<SonarrSeries[]>(config, `/api/v3/series/lookup?term=${encodeURIComponent(term)}`);
}

export async function addSeries(
  config: SonarrConfig,
  tvdbId: number,
  qualityProfileId: number,
  rootFolderPath: string,
  monitoredSeasons?: number[],
  languageProfileId?: number
): Promise<SonarrSeries> {
  // Check if series already exists in Sonarr
  const allSeries = await sonarrFetch<SonarrSeries[]>(config, '/api/v3/series');
  const existing = allSeries.find((s) => s.tvdbId === tvdbId);
  if (existing) {
    return existing;
  }

  // Look up by TVDB ID to get full series details
  const results = await lookupSeries(config, `tvdb:${tvdbId}`);
  const series = results[0];

  if (!series) {
    throw new Error(`Series with TVDB ID ${tvdbId} not found`);
  }

  const payload: Record<string, unknown> = {
    tvdbId: series.tvdbId,
    title: series.title,
    qualityProfileId,
    rootFolderPath,
    monitored: true,
    seasonFolder: true,
    seasons: series.seasons?.map((s) => ({
      ...s,
      monitored: monitoredSeasons
        ? monitoredSeasons.includes(s.seasonNumber)
        : true,
    })) ?? [],
    addOptions: {
      searchForMissingEpisodes: true,
    },
  };

  // Sonarr v3 requires languageProfileId; v4 removed it
  if (languageProfileId) {
    payload.languageProfileId = languageProfileId;
  }

  return sonarrFetch<SonarrSeries>(config, '/api/v3/series', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getSeries(config: SonarrConfig, sonarrId: number): Promise<SonarrSeries> {
  return sonarrFetch<SonarrSeries>(config, `/api/v3/series/${sonarrId}`);
}

export async function getAllSeries(config: SonarrConfig): Promise<SonarrSeries[]> {
  return sonarrFetch<SonarrSeries[]>(config, '/api/v3/series');
}

export async function getQualityProfiles(config: SonarrConfig): Promise<QualityProfile[]> {
  return sonarrFetch<QualityProfile[]>(config, '/api/v3/qualityprofile');
}

export async function getLanguageProfiles(config: SonarrConfig): Promise<QualityProfile[]> {
  return sonarrFetch<QualityProfile[]>(config, '/api/v3/languageprofile');
}

export async function getRootFolders(config: SonarrConfig): Promise<RootFolder[]> {
  return sonarrFetch<RootFolder[]>(config, '/api/v3/rootfolder');
}

export async function getEpisodes(config: SonarrConfig, seriesId: number): Promise<SonarrEpisode[]> {
  return sonarrFetch<SonarrEpisode[]>(config, `/api/v3/episode?seriesId=${seriesId}`);
}

export async function getQueue(config: SonarrConfig): Promise<SonarrQueueItem[]> {
  const response = await sonarrFetch<SonarrQueueResponse>(config, '/api/v3/queue?pageSize=100&includeSeries=false&includeEpisode=false');
  return response.records;
}

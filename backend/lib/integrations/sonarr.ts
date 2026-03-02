interface SonarrConfig {
  baseUrl: string;
  apiKey: string;
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
  seasons?: Array<{ seasonNumber: number; monitored: boolean }>;
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
  rootFolderPath: string
): Promise<SonarrSeries> {
  // Look up by TVDB ID to get full series details
  const results = await lookupSeries(config, `tvdb:${tvdbId}`);
  const series = results[0];

  if (!series) {
    throw new Error(`Series with TVDB ID ${tvdbId} not found`);
  }

  return sonarrFetch<SonarrSeries>(config, '/api/v3/series', {
    method: 'POST',
    body: JSON.stringify({
      tvdbId: series.tvdbId,
      title: series.title,
      qualityProfileId,
      rootFolderPath,
      monitored: true,
      seasonFolder: true,
      seasons: series.seasons?.map((s) => ({ ...s, monitored: true })) ?? [],
      addOptions: {
        searchForMissingEpisodes: true,
      },
    }),
  });
}

export async function getSeries(config: SonarrConfig, sonarrId: number): Promise<SonarrSeries> {
  return sonarrFetch<SonarrSeries>(config, `/api/v3/series/${sonarrId}`);
}

export async function getQualityProfiles(config: SonarrConfig): Promise<QualityProfile[]> {
  return sonarrFetch<QualityProfile[]>(config, '/api/v3/qualityprofile');
}

export async function getRootFolders(config: SonarrConfig): Promise<RootFolder[]> {
  return sonarrFetch<RootFolder[]>(config, '/api/v3/rootfolder');
}

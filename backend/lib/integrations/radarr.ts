interface RadarrConfig {
  baseUrl: string;
  apiKey: string;
}

interface RadarrMovie {
  id: number;
  tmdbId: number;
  title: string;
  year: number;
  overview: string;
  remotePoster?: string;
  images?: Array<{ coverType: string; remoteUrl: string }>;
  path?: string;
  qualityProfileId?: number;
  rootFolderPath?: string;
  monitored?: boolean;
  hasFile?: boolean;
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

async function radarrFetch<T>(config: RadarrConfig, path: string, options?: RequestInit): Promise<T> {
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
    throw new Error(`Radarr API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

export async function testConnection(config: RadarrConfig): Promise<SystemStatus> {
  return radarrFetch<SystemStatus>(config, '/api/v3/system/status');
}

export async function lookupMovie(config: RadarrConfig, tmdbId: number): Promise<RadarrMovie> {
  return radarrFetch<RadarrMovie>(config, `/api/v3/movie/lookup/tmdb?tmdbId=${tmdbId}`);
}

export async function addMovie(
  config: RadarrConfig,
  tmdbId: number,
  qualityProfileId: number,
  rootFolderPath: string
): Promise<RadarrMovie> {
  // First lookup the movie to get its full details
  const movie = await lookupMovie(config, tmdbId);

  return radarrFetch<RadarrMovie>(config, '/api/v3/movie', {
    method: 'POST',
    body: JSON.stringify({
      tmdbId: movie.tmdbId,
      title: movie.title,
      year: movie.year,
      qualityProfileId,
      rootFolderPath,
      monitored: true,
      addOptions: {
        searchForMovie: true,
      },
    }),
  });
}

export async function getMovie(config: RadarrConfig, radarrId: number): Promise<RadarrMovie> {
  return radarrFetch<RadarrMovie>(config, `/api/v3/movie/${radarrId}`);
}

export async function getQualityProfiles(config: RadarrConfig): Promise<QualityProfile[]> {
  return radarrFetch<QualityProfile[]>(config, '/api/v3/qualityprofile');
}

export async function getRootFolders(config: RadarrConfig): Promise<RootFolder[]> {
  return radarrFetch<RootFolder[]>(config, '/api/v3/rootfolder');
}

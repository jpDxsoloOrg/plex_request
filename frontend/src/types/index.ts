/** Media request status values */
export type RequestStatus = 'requested' | 'approved' | 'downloading' | 'complete' | 'rejected';

/** Media type */
export type MediaType = 'movie' | 'tv';

/** Media request item */
export interface MediaRequest {
  requestId: string;
  userId: string;
  userName: string;
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  year: string;
  overview: string;
  posterPath: string;
  status: RequestStatus;
  adminNote?: string;
  seasons?: number[];
  radarrId?: number;
  sonarrId?: number;
  requestedAt: string;
  updatedAt: string;
}

/** Media search result (normalized from Radarr/Sonarr) */
export interface MediaSearchResult {
  id: number;
  title: string;
  year: string;
  overview: string;
  posterUrl: string;
  mediaType: MediaType;
  seasonCount?: number;
  seasons?: Array<{ seasonNumber: number }>;
}

/** Integration setting (API keys masked in responses) */
export interface IntegrationSetting {
  settingKey: string;
  baseUrl: string;
  apiKey: string;
  qualityProfileId?: number;
  languageProfileId?: number;
  rootFolderPath?: string;
  enabled: boolean;
}

/** Dashboard stats from admin API */
export interface DashboardStats {
  counts: Record<RequestStatus, number>;
  total: number;
  recentPending: MediaRequest[];
}

/** Test connection result */
export interface TestConnectionResult {
  connected: boolean;
  service: string;
  version?: string;
  error?: string;
}

/** Quality profile from Radarr/Sonarr */
export interface QualityProfile {
  id: number;
  name: string;
}

/** Root folder from Radarr/Sonarr */
export interface RootFolder {
  id: number;
  path: string;
  freeSpace: number;
}

/** Auth user context */
export interface User {
  userId: string;
  email: string;
  groups: string[];
}

/** Library movie from GET /library/movies */
export interface LibraryMovie {
  radarrId: number;
  tmdbId: number;
  title: string;
  year: number;
  posterUrl: string;
  status: 'downloaded' | 'missing';
  sizeOnDisk: number;
  monitored: boolean;
}

/** Library show from GET /library/shows */
export interface LibraryShow {
  sonarrId: number;
  tvdbId: number;
  title: string;
  year: number;
  posterUrl: string;
  status: 'downloaded' | 'partial' | 'missing';
  monitored: boolean;
  episodeFileCount: number;
  episodeCount: number;
  totalEpisodeCount: number;
  sizeOnDisk: number;
  percentComplete: number;
  seasons: LibraryShowSeason[];
}

export interface LibraryShowSeason {
  seasonNumber: number;
  monitored: boolean;
  episodeFileCount: number;
  episodeCount: number;
  totalEpisodeCount: number;
  percentComplete: number;
}

/** Episode from GET /library/shows/:id/episodes */
export interface LibraryEpisode {
  episodeId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate: string;
  overview: string;
  hasFile: boolean;
  monitored: boolean;
}

/** Download status for a request */
export type DownloadState = 'queued' | 'downloading' | 'importing' | 'completed' | 'failed' | 'warning' | 'pending';

export interface DownloadStatus {
  requestId: string;
  downloadState: DownloadState;
  percentComplete: number;
  sizeTotal?: number;
  sizeRemaining?: number;
  estimatedCompletion?: string;
  downloadClient?: string;
}

/** Media issue types */
export type IssueType = 'wrong_language' | 'corrupt' | 'missing_subtitles' | 'wrong_content' | 'other';
export type IssueStatus = 'open' | 'acknowledged' | 'resolved';

/** Media issue */
export interface MediaIssue {
  issueId: string;
  userId: string;
  userName: string;
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  year: string;
  posterPath: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  issueType: IssueType;
  description?: string;
  status: IssueStatus;
  adminNote?: string;
  reportedAt: string;
  updatedAt: string;
}

/** Library item from DynamoDB cache */
export interface LibraryItem {
  pk: string;
  mediaType: MediaType;
  title: string;
  year: number;
  tmdbId?: number;
  radarrId?: number;
  tvdbId?: number;
  sonarrId?: number;
  hasFile: boolean;
  syncedAt: string;
}

/** Episode info from Sonarr */
export interface EpisodeInfo {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  hasFile: boolean;
}

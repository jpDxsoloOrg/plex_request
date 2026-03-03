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

/** Episode info from Sonarr */
export interface EpisodeInfo {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  hasFile: boolean;
}

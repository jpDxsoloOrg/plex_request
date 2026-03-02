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

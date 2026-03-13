/** Media request status values */
export type RequestStatus = 'requested' | 'approved' | 'downloading' | 'complete' | 'rejected';

/** Media type */
export type MediaType = 'movie' | 'tv';

/** DynamoDB Requests table item */
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
  autoApproved?: boolean;
  radarrId?: number;
  sonarrId?: number;
  requestedAt: string;
  updatedAt: string;
}

/** User preferences stored in UserPreferences table */
export interface UserPreference {
  userId: string;
  autoApprove: boolean;
  updatedAt: string;
}

/** Admin view of a user (merged from Cognito + UserPreferences + request stats) */
export interface AdminUser {
  userId: string;
  email: string;
  status: string;
  autoApprove: boolean;
  requestCount: number;
  createdAt: string;
}

/** DynamoDB Settings table item */
export interface IntegrationSetting {
  settingKey: string;
  baseUrl: string;
  apiKey: string;
  qualityProfileId?: number;
  languageProfileId?: number;
  rootFolderPath?: string;
  enabled: boolean;
}

/** Valid status transitions */
export const VALID_STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  requested: ['approved', 'rejected'],
  approved: ['downloading'],
  downloading: ['complete'],
  complete: [],
  rejected: [],
};

/** DynamoDB LibraryTable item */
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
  ttl?: number;
}

/** Library movie returned from GET /library/movies */
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

/** Library show returned from GET /library/shows */
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

/** Per-season summary within a library show */
export interface LibraryShowSeason {
  seasonNumber: number;
  monitored: boolean;
  episodeFileCount: number;
  episodeCount: number;
  totalEpisodeCount: number;
  percentComplete: number;
}

/** Episode returned from GET /library/shows/:id/episodes */
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

/** Download status for a single request */
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

/** DynamoDB MediaIssues table item */
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

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
  radarrId?: number;
  sonarrId?: number;
  requestedAt: string;
  updatedAt: string;
}

/** DynamoDB Settings table item */
export interface IntegrationSetting {
  settingKey: string;
  baseUrl: string;
  apiKey: string;
  qualityProfileId?: number;
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

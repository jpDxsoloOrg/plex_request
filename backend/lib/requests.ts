import { v4 as uuidv4 } from 'uuid';
import { putItem, query, getItem, REQUESTS_TABLE, USER_PREFERENCES_TABLE } from './dynamodb';
import { handleApproval } from './approval';
import type { MediaType, MediaRequest, RequestStatus, UserPreference } from '../types';

const ACTIVE_REQUEST_STATUSES: RequestStatus[] = ['requested', 'approved', 'downloading'];

export interface NewRequestInput {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  year?: string;
  overview?: string;
  posterPath?: string;
  seasons?: number[];
}

export interface RequestingUser {
  userId: string;
  email: string;
}

export type CreateRequestResult =
  | { outcome: 'created'; request: MediaRequest }
  | { outcome: 'duplicate' }
  | { outcome: 'invalidSeasons' };

export async function findActiveRequests(tmdbId: number, mediaType: MediaType): Promise<MediaRequest[]> {
  const activeRequests: MediaRequest[] = [];
  for (const status of ACTIVE_REQUEST_STATUSES) {
    const matches = await query({
      TableName: REQUESTS_TABLE,
      IndexName: 'StatusIndex',
      KeyConditionExpression: '#status = :status',
      FilterExpression: 'tmdbId = :tmdbId AND mediaType = :mediaType',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': status,
        ':tmdbId': tmdbId,
        ':mediaType': mediaType,
      },
    });
    activeRequests.push(...(matches as MediaRequest[]));
  }
  return activeRequests;
}

export async function createMediaRequest(
  input: NewRequestInput,
  user: RequestingUser
): Promise<CreateRequestResult> {
  const existingRequests = await findActiveRequests(input.tmdbId, input.mediaType);
  if (existingRequests.length > 0) {
    return { outcome: 'duplicate' };
  }

  if (input.seasons !== undefined) {
    if (!Array.isArray(input.seasons) || input.seasons.some((s) => !Number.isInteger(s) || s < 1)) {
      return { outcome: 'invalidSeasons' };
    }
  }

  const userPref = await getItem({
    TableName: USER_PREFERENCES_TABLE,
    Key: { userId: user.userId },
  }) as UserPreference | undefined;

  const now = new Date().toISOString();
  const requestData: MediaRequest = {
    requestId: uuidv4(),
    userId: user.userId,
    userName: user.email,
    mediaType: input.mediaType,
    tmdbId: input.tmdbId,
    title: input.title,
    year: input.year ?? '',
    overview: input.overview ?? '',
    posterPath: input.posterPath ?? '',
    status: 'requested',
    ...(input.seasons?.length ? { seasons: input.seasons } : {}),
    requestedAt: now,
    updatedAt: now,
  };

  if (userPref?.autoApprove) {
    try {
      const integrationIds = await handleApproval(requestData);
      requestData.status = 'approved';
      requestData.autoApproved = true;
      if (integrationIds.radarrId) requestData.radarrId = integrationIds.radarrId;
      if (integrationIds.sonarrId) requestData.sonarrId = integrationIds.sonarrId;
    } catch (error) {
      // A trusted user's request must not be lost when Radarr or Sonarr is down
      console.error('Auto-approve integration failed, falling back to manual:', error);
      requestData.status = 'requested';
      requestData.adminNote = 'Auto-approve failed: ' +
        (error instanceof Error ? error.message : 'Unknown error');
    }
  }

  await putItem({
    TableName: REQUESTS_TABLE,
    Item: requestData,
  });

  return { outcome: 'created', request: requestData };
}

import { v4 as uuidv4 } from 'uuid';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { putItem, query, REQUESTS_TABLE } from '../../lib/dynamodb';
import { getUserContext } from '../../lib/auth';
import { created, badRequest, conflict, serverError } from '../../lib/response';
import type { MediaType, MediaRequest } from '../../types';

interface CreateRequestBody {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  year: string;
  overview: string;
  posterPath: string;
  seasons?: number[];
}

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  if (!event.body) {
    return badRequest('Request body is required');
  }

  const body = JSON.parse(event.body) as CreateRequestBody;

  if (!body.mediaType || !body.tmdbId || !body.title) {
    return badRequest('mediaType, tmdbId, and title are required');
  }

  if (body.mediaType !== 'movie' && body.mediaType !== 'tv') {
    return badRequest('mediaType must be "movie" or "tv"');
  }

  const user = getUserContext(event);

  try {
    // Check for duplicate: same tmdbId + mediaType not already active
    const existingRequests = await query({
      TableName: REQUESTS_TABLE,
      IndexName: 'StatusIndex',
      KeyConditionExpression: '#status = :status',
      FilterExpression: 'tmdbId = :tmdbId AND mediaType = :mediaType',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'requested',
        ':tmdbId': body.tmdbId,
        ':mediaType': body.mediaType,
      },
    });

    // Also check approved and downloading statuses
    const activeStatuses = ['approved', 'downloading'];
    for (const status of activeStatuses) {
      const active = await query({
        TableName: REQUESTS_TABLE,
        IndexName: 'StatusIndex',
        KeyConditionExpression: '#status = :status',
        FilterExpression: 'tmdbId = :tmdbId AND mediaType = :mediaType',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': status,
          ':tmdbId': body.tmdbId,
          ':mediaType': body.mediaType,
        },
      });
      existingRequests.push(...active);
    }

    if (existingRequests.length > 0) {
      return conflict('This media has already been requested');
    }

    // Validate seasons if provided
    if (body.seasons !== undefined) {
      if (!Array.isArray(body.seasons) || body.seasons.some((s) => !Number.isInteger(s) || s < 1)) {
        return badRequest('seasons must be an array of positive integers');
      }
    }

    const now = new Date().toISOString();
    const request: MediaRequest = {
      requestId: uuidv4(),
      userId: user.userId,
      userName: user.email,
      mediaType: body.mediaType,
      tmdbId: body.tmdbId,
      title: body.title,
      year: body.year ?? '',
      overview: body.overview ?? '',
      posterPath: body.posterPath ?? '',
      status: 'requested',
      ...(body.seasons?.length ? { seasons: body.seasons } : {}),
      requestedAt: now,
      updatedAt: now,
    };

    await putItem({
      TableName: REQUESTS_TABLE,
      Item: request,
    });

    return created(request);
  } catch (error) {
    console.error('Create request error:', error);
    return serverError('Failed to create request');
  }
};

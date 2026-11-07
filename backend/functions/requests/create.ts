import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getUserContext } from '../../lib/auth';
import { createMediaRequest, type NewRequestInput } from '../../lib/requests';
import { created, badRequest, conflict, serverError } from '../../lib/response';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  if (!event.body) {
    return badRequest('Request body is required');
  }

  const body = JSON.parse(event.body) as NewRequestInput;

  if (!body.mediaType || !body.tmdbId || !body.title) {
    return badRequest('mediaType, tmdbId, and title are required');
  }

  if (body.mediaType !== 'movie' && body.mediaType !== 'tv') {
    return badRequest('mediaType must be "movie" or "tv"');
  }

  const user = getUserContext(event);

  try {
    const result = await createMediaRequest(body, user);

    if (result.outcome === 'duplicate') {
      return conflict('This media has already been requested');
    }
    if (result.outcome === 'invalidSeasons') {
      return badRequest('seasons must be an array of positive integers');
    }
    return created(result.request);
  } catch (error) {
    console.error('Create request error:', error);
    return serverError('Failed to create request');
  }
};

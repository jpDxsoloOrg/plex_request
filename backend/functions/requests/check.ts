import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getItem, LIBRARY_TABLE } from '../../lib/dynamodb';
import { success, badRequest } from '../../lib/response';
import type { LibraryItem } from '../../types';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const tmdbId = event.queryStringParameters?.tmdbId;
  const mediaType = event.queryStringParameters?.mediaType;

  if (!tmdbId || !mediaType) {
    return badRequest('tmdbId and mediaType are required');
  }

  try {
    const pk = mediaType === 'movie' ? `movie#${tmdbId}` : `tv#${tmdbId}`;
    const item = await getItem({
      TableName: LIBRARY_TABLE,
      Key: { pk },
    }) as LibraryItem | undefined;

    if (item) {
      return success({
        exists: true,
        hasFile: item.hasFile ?? false,
        message: mediaType === 'movie'
          ? (item.hasFile
              ? 'This movie is already available in your library.'
              : 'This movie is already being monitored and will be available soon.')
          : 'This show is already being monitored in your library.',
      });
    }

    return success({ exists: false });
  } catch (error) {
    console.error('Check media error:', error);
    return success({ exists: false });
  }
};

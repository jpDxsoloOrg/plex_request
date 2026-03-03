import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { scan, LIBRARY_TABLE } from '../../lib/dynamodb';
import { success, serverError } from '../../lib/response';
import type { LibraryItem } from '../../types';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const mediaType = event.queryStringParameters?.mediaType;
    const searchTerm = event.queryStringParameters?.search?.toLowerCase();

    // Scan the full library table (typically <2k items, well within scan limits)
    const items = await scan({ TableName: LIBRARY_TABLE }) as LibraryItem[];

    let filtered = items;

    if (mediaType && (mediaType === 'movie' || mediaType === 'tv')) {
      filtered = filtered.filter((item) => item.mediaType === mediaType);
    }

    if (searchTerm) {
      filtered = filtered.filter((item) =>
        item.title.toLowerCase().includes(searchTerm)
      );
    }

    // Sort alphabetically by title
    filtered.sort((a, b) => a.title.localeCompare(b.title));

    return success({ items: filtered, total: filtered.length });
  } catch (error) {
    console.error('List library error:', error);
    return serverError('Failed to fetch library');
  }
};

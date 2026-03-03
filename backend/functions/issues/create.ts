import { v4 as uuidv4 } from 'uuid';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { putItem, ISSUES_TABLE } from '../../lib/dynamodb';
import { getUserContext } from '../../lib/auth';
import { created, badRequest, serverError } from '../../lib/response';
import type { MediaType, IssueType, MediaIssue } from '../../types';

const VALID_ISSUE_TYPES: IssueType[] = ['wrong_language', 'corrupt', 'missing_subtitles', 'wrong_content', 'other'];

interface CreateIssueBody {
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
}

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  if (!event.body) {
    return badRequest('Request body is required');
  }

  const body = JSON.parse(event.body) as CreateIssueBody;

  if (!body.mediaType || !body.tmdbId || !body.title || !body.issueType) {
    return badRequest('mediaType, tmdbId, title, and issueType are required');
  }

  if (!VALID_ISSUE_TYPES.includes(body.issueType)) {
    return badRequest(`issueType must be one of: ${VALID_ISSUE_TYPES.join(', ')}`);
  }

  if (body.issueType === 'other' && !body.description?.trim()) {
    return badRequest('description is required when issueType is "other"');
  }

  const user = getUserContext(event);
  const now = new Date().toISOString();

  const issue: MediaIssue = {
    issueId: uuidv4(),
    userId: user.userId,
    userName: user.email,
    mediaType: body.mediaType,
    tmdbId: body.tmdbId,
    title: body.title,
    year: body.year ?? '',
    posterPath: body.posterPath ?? '',
    ...(body.seasonNumber !== undefined ? { seasonNumber: body.seasonNumber } : {}),
    ...(body.episodeNumber !== undefined ? { episodeNumber: body.episodeNumber } : {}),
    ...(body.episodeTitle ? { episodeTitle: body.episodeTitle } : {}),
    issueType: body.issueType,
    ...(body.description?.trim() ? { description: body.description.trim() } : {}),
    status: 'open',
    reportedAt: now,
    updatedAt: now,
  };

  try {
    await putItem({
      TableName: ISSUES_TABLE,
      Item: issue,
    });

    return created(issue);
  } catch (error) {
    console.error('Create issue error:', error);
    return serverError('Failed to create issue');
  }
};

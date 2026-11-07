import { getItem, scanAll, LIBRARY_TABLE } from '../../lib/dynamodb';
import { createMediaRequest, findActiveRequests } from '../../lib/requests';
import { findVerifiedUserByEmail, type VerifiedUser } from '../../lib/users';
import type { LibraryItem, RequestStatus } from '../../types';

const TMDB_POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const MAX_EMAIL_LENGTH = 254;
const MAX_TITLE_LENGTH = 500;
const MAX_OVERVIEW_LENGTH = 5000;
const MAX_POSTER_LENGTH = 1000;

type IntegrationErrorCode = 'INVALID_INPUT' | 'INTERNAL_ERROR';

export type IntegrationResponse<Data = unknown> =
  | { ok: true; data: Data }
  | { ok: false; error: IntegrationErrorCode; message: string };

export interface LibraryMovieEntry {
  tmdbId: number;
  hasFile: boolean;
}

export interface LibraryShowEntry {
  tvdbId: number;
  hasFile: boolean;
}

export interface MovieStatus {
  inLibrary: boolean;
  hasFile: boolean;
  activeRequest: { status: RequestStatus; requestedByUser: boolean } | null;
}

export type CreateRequestData =
  | { outcome: 'created'; requestId: string; status: RequestStatus; autoApproved: boolean }
  | { outcome: 'duplicate' };

class InvalidInputError extends Error {}

function requireEmail(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > MAX_EMAIL_LENGTH ||
    !/^[^\s@]+@[^\s@]+$/.test(value)
  ) {
    throw new InvalidInputError('email must be a valid email address');
  }
  return value;
}

function requireUserId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9-]{1,128}$/.test(value)) {
    throw new InvalidInputError('userId must be a Plex Request user id');
  }
  return value;
}

function requireTmdbId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new InvalidInputError('tmdbId must be a positive integer');
  }
  return value;
}

function requireTitle(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_TITLE_LENGTH) {
    throw new InvalidInputError(`title must be 1 to ${MAX_TITLE_LENGTH} characters`);
  }
  return value;
}

function optionalYear(value: unknown): string {
  const year = value === undefined || value === null ? '' : String(value);
  if (year && !/^\d{4}$/.test(year)) {
    throw new InvalidInputError('year must be four digits');
  }
  return year;
}

function optionalOverview(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value !== 'string' || value.length > MAX_OVERVIEW_LENGTH) {
    throw new InvalidInputError(`overview must be at most ${MAX_OVERVIEW_LENGTH} characters`);
  }
  return value;
}

// Plex Request's pages use this field directly as an image src, so a bare TMDB
// path has to become a full URL before it is stored.
function optionalPosterUrl(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  if (typeof value !== 'string' || value.length > MAX_POSTER_LENGTH) {
    throw new InvalidInputError('posterPath must be a TMDB path or an https URL');
  }
  if (value.startsWith('https://')) {
    return value;
  }
  if (/^\/[^/]/.test(value)) {
    return `${TMDB_POSTER_BASE_URL}${value}`;
  }
  throw new InvalidInputError('posterPath must be a TMDB path or an https URL');
}

async function findUser(payload: Record<string, unknown>): Promise<VerifiedUser | null> {
  return findVerifiedUserByEmail(requireEmail(payload.email));
}

async function libraryMovies(): Promise<LibraryMovieEntry[]> {
  const rows = await scanAll({
    TableName: LIBRARY_TABLE,
    FilterExpression: '#mediaType = :mediaType',
    ProjectionExpression: 'tmdbId, hasFile',
    ExpressionAttributeNames: { '#mediaType': 'mediaType' },
    ExpressionAttributeValues: { ':mediaType': 'movie' },
  });
  return rows
    .filter((row) => typeof row.tmdbId === 'number' && row.tmdbId > 0)
    .map((row) => ({ tmdbId: row.tmdbId as number, hasFile: row.hasFile === true }));
}

// Library sync writes hasFile: false for every series, so today a row only
// means "Sonarr has this show", not "episodes are on disk".
async function libraryShows(): Promise<LibraryShowEntry[]> {
  const rows = await scanAll({
    TableName: LIBRARY_TABLE,
    FilterExpression: '#mediaType = :mediaType',
    ProjectionExpression: 'tvdbId, hasFile',
    ExpressionAttributeNames: { '#mediaType': 'mediaType' },
    ExpressionAttributeValues: { ':mediaType': 'tv' },
  });
  return rows
    .filter((row) => typeof row.tvdbId === 'number' && row.tvdbId > 0)
    .map((row) => ({ tvdbId: row.tvdbId as number, hasFile: row.hasFile === true }));
}

async function movieStatus(payload: Record<string, unknown>): Promise<MovieStatus> {
  const tmdbId = requireTmdbId(payload.tmdbId);
  const userId = requireUserId(payload.userId);

  const [libraryItem, activeRequests] = await Promise.all([
    getItem({ TableName: LIBRARY_TABLE, Key: { pk: `movie#${tmdbId}` } }) as Promise<LibraryItem | undefined>,
    findActiveRequests(tmdbId, 'movie'),
  ]);

  const ownRequest = activeRequests.find((request) => request.userId === userId);
  const activeRequest = ownRequest ?? activeRequests[0];

  return {
    inLibrary: libraryItem !== undefined,
    hasFile: libraryItem?.hasFile === true,
    activeRequest: activeRequest
      ? { status: activeRequest.status, requestedByUser: ownRequest !== undefined }
      : null,
  };
}

// Movies only. The Sonarr approval path has an id bug that must be fixed before
// TV requests can arrive here.
async function createRequest(payload: Record<string, unknown>): Promise<CreateRequestData> {
  const user = { userId: requireUserId(payload.userId), email: requireEmail(payload.email) };
  const result = await createMediaRequest(
    {
      mediaType: 'movie',
      tmdbId: requireTmdbId(payload.tmdbId),
      title: requireTitle(payload.title),
      year: optionalYear(payload.year),
      overview: optionalOverview(payload.overview),
      posterPath: optionalPosterUrl(payload.posterPath),
    },
    user
  );

  if (result.outcome === 'created') {
    // adminNote stays private: it can quote raw Radarr error bodies
    const { requestId, status, autoApproved } = result.request;
    return { outcome: 'created', requestId, status, autoApproved: autoApproved === true };
  }
  if (result.outcome === 'duplicate') {
    return { outcome: 'duplicate' };
  }
  throw new Error('Unexpected seasons rejection for a movie request');
}

async function dispatch(payload: Record<string, unknown>): Promise<unknown> {
  switch (payload.op) {
    case 'findUser':
      return findUser(payload);
    case 'libraryMovies':
      return libraryMovies();
    case 'libraryShows':
      return libraryShows();
    case 'movieStatus':
      return movieStatus(payload);
    case 'createRequest':
      return createRequest(payload);
    default:
      throw new InvalidInputError('op must be findUser, libraryMovies, libraryShows, movieStatus or createRequest');
  }
}

export const handler = async (event: unknown): Promise<IntegrationResponse> => {
  try {
    if (typeof event !== 'object' || event === null || Array.isArray(event)) {
      throw new InvalidInputError('event must be an object');
    }
    return { ok: true, data: await dispatch(event as Record<string, unknown>) };
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return { ok: false, error: 'INVALID_INPUT', message: error.message };
    }
    console.error('Integration error:', error);
    return { ok: false, error: 'INTERNAL_ERROR', message: 'Plex Request could not complete the operation' };
  }
};

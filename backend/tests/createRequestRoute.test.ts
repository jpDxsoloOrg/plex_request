import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { handler } from '../functions/requests/create';
import type { MediaRequest, RequestStatus } from '../types';
import { createFakeState, installFakeDynamo, installFakeRadarr } from './fakes';

const USER_ID = 'user-1';
const USER_EMAIL = 'member@example.com';

const movieBody = {
  mediaType: 'movie',
  tmdbId: 603,
  title: 'The Matrix',
  year: '1999',
  overview: 'A hacker learns the truth.',
  posterPath: 'https://image.example/matrix.jpg',
};

function routeEvent(body: unknown): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    body: body === undefined ? undefined : JSON.stringify(body),
    requestContext: {
      authorizer: { jwt: { claims: { sub: USER_ID, email: USER_EMAIL } } },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

async function post(body: unknown): Promise<{ statusCode: number; json: Record<string, unknown> }> {
  const result = await handler(routeEvent(body)) as APIGatewayProxyStructuredResultV2;
  return { statusCode: result.statusCode ?? 0, json: JSON.parse(result.body ?? '{}') as Record<string, unknown> };
}

function existingRequest(status: RequestStatus, overrides: Partial<MediaRequest> = {}): MediaRequest {
  return {
    requestId: `existing-${status}`,
    userId: 'someone-else',
    userName: 'other@example.com',
    mediaType: 'movie',
    tmdbId: 603,
    title: 'The Matrix',
    year: '1999',
    overview: '',
    posterPath: '',
    status,
    requestedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function trustUser(): { userId: string; autoApprove: boolean; updatedAt: string } {
  return { userId: USER_ID, autoApprove: true, updatedAt: '2026-01-01T00:00:00.000Z' };
}

describe('POST /requests', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('rejects a missing body', async () => {
    installFakeDynamo(createFakeState());
    const response = await post(undefined);
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json, { error: 'Request body is required' });
  });

  it('rejects missing required fields', async () => {
    installFakeDynamo(createFakeState());
    const response = await post({ mediaType: 'movie', tmdbId: 603 });
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json, { error: 'mediaType, tmdbId, and title are required' });
  });

  it('rejects an unknown mediaType', async () => {
    installFakeDynamo(createFakeState());
    const response = await post({ ...movieBody, mediaType: 'book' });
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json, { error: 'mediaType must be "movie" or "tv"' });
  });

  it('stores a pending request for an untrusted user without calling Radarr', async () => {
    const state = createFakeState();
    installFakeDynamo(state);
    const radarr = installFakeRadarr();

    const response = await post(movieBody);

    assert.equal(response.statusCode, 201);
    assert.equal(radarr.calls.length, 0);
    assert.equal(state.requests.length, 1);
    assert.deepEqual(response.json, state.requests[0]);
    const { requestId, requestedAt, updatedAt, ...stored } = state.requests[0];
    assert.ok(requestId);
    assert.equal(requestedAt, updatedAt);
    assert.deepEqual(stored, {
      userId: USER_ID,
      userName: USER_EMAIL,
      mediaType: 'movie',
      tmdbId: 603,
      title: 'The Matrix',
      year: '1999',
      overview: 'A hacker learns the truth.',
      posterPath: 'https://image.example/matrix.jpg',
      status: 'requested',
    });
  });

  it('defaults optional text fields to empty strings', async () => {
    const state = createFakeState();
    installFakeDynamo(state);

    const response = await post({ mediaType: 'movie', tmdbId: 603, title: 'The Matrix' });

    assert.equal(response.statusCode, 201);
    assert.equal(state.requests[0].year, '');
    assert.equal(state.requests[0].overview, '');
    assert.equal(state.requests[0].posterPath, '');
  });

  it('checks every active status in order', async () => {
    const state = createFakeState();
    installFakeDynamo(state);
    await post(movieBody);
    assert.deepEqual(state.statusQueries, ['requested', 'approved', 'downloading']);
  });

  for (const status of ['requested', 'approved', 'downloading'] as const) {
    it(`answers 409 when the title is already ${status}`, async () => {
      const state = createFakeState({ requests: [existingRequest(status)] });
      installFakeDynamo(state);

      const response = await post(movieBody);

      assert.equal(response.statusCode, 409);
      assert.deepEqual(response.json, { error: 'This media has already been requested' });
      assert.equal(state.requests.length, 1);
    });
  }

  for (const status of ['complete', 'rejected'] as const) {
    it(`allows a new request when the earlier one is ${status}`, async () => {
      const state = createFakeState({ requests: [existingRequest(status)] });
      installFakeDynamo(state);
      const response = await post(movieBody);
      assert.equal(response.statusCode, 201);
    });
  }

  it('treats the same id under another mediaType as a different title', async () => {
    const state = createFakeState({ requests: [existingRequest('requested', { mediaType: 'tv' })] });
    installFakeDynamo(state);
    const response = await post(movieBody);
    assert.equal(response.statusCode, 201);
  });

  it('rejects invalid seasons', async () => {
    const state = createFakeState();
    installFakeDynamo(state);

    const response = await post({ ...movieBody, mediaType: 'tv', seasons: [1, 0] });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json, { error: 'seasons must be an array of positive integers' });
    assert.equal(state.requests.length, 0);
  });

  it('reports a duplicate before looking at seasons', async () => {
    const state = createFakeState({ requests: [existingRequest('requested', { mediaType: 'tv' })] });
    installFakeDynamo(state);
    const response = await post({ ...movieBody, mediaType: 'tv', seasons: ['bad'] });
    assert.equal(response.statusCode, 409);
  });

  it('stores seasons when given and omits an empty list', async () => {
    const state = createFakeState();
    installFakeDynamo(state);

    await post({ ...movieBody, mediaType: 'tv', seasons: [1, 2] });
    assert.deepEqual(state.requests[0].seasons, [1, 2]);

    await post({ ...movieBody, tmdbId: 604, mediaType: 'tv', seasons: [] });
    assert.equal('seasons' in state.requests[1], false);
  });

  it('auto-approves a trusted user through Radarr', async () => {
    const state = createFakeState({ preferences: [trustUser()] });
    installFakeDynamo(state);
    const radarr = installFakeRadarr();

    const response = await post(movieBody);

    assert.equal(response.statusCode, 201);
    assert.equal(response.json.status, 'approved');
    assert.equal(response.json.autoApproved, true);
    assert.equal(response.json.radarrId, 77);
    assert.deepEqual(state.requests[0], response.json);
    assert.ok(radarr.calls.some((call) => call.method === 'POST'));
  });

  it('does not auto-approve when the preference is switched off', async () => {
    const state = createFakeState({ preferences: [{ ...trustUser(), autoApprove: false }] });
    installFakeDynamo(state);
    const radarr = installFakeRadarr();

    const response = await post(movieBody);

    assert.equal(response.json.status, 'requested');
    assert.equal(radarr.calls.length, 0);
  });

  it('falls back to manual approval when Radarr fails for a trusted user', async () => {
    const state = createFakeState({ preferences: [trustUser()] });
    installFakeDynamo(state);
    installFakeRadarr({ failing: true });
    mock.method(console, 'error', () => undefined);

    const response = await post(movieBody);

    assert.equal(response.statusCode, 201);
    assert.equal(response.json.status, 'requested');
    assert.equal(response.json.autoApproved, undefined);
    assert.equal(response.json.adminNote, 'Auto-approve failed: Radarr API error 500: radarr exploded');
    assert.equal(state.requests.length, 1);
  });

  it('answers 500 when the table cannot be read', async () => {
    installFakeDynamo(createFakeState({ failWith: new Error('dynamo down') }));
    mock.method(console, 'error', () => undefined);

    const response = await post(movieBody);

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.json, { error: 'Failed to create request' });
  });
});

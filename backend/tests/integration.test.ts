import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import type { UserType } from '@aws-sdk/client-cognito-identity-provider';
import { handler } from '../functions/integration/handler';
import { cognitoClient } from '../lib/users';
import type { MediaRequest, RequestStatus } from '../types';
import {
  createFakeState,
  installFakeDynamo,
  installFakeRadarr,
  RADARR_SETTING,
  type FakeLibraryRow,
} from './fakes';

const USER_ID = '0a1b2c3d-1111-2222-3333-444455556666';

function cognitoUser(
  sub: string,
  email: string,
  overrides: Partial<UserType> = {},
  emailVerified = 'true'
): UserType {
  return {
    Username: sub,
    UserStatus: 'CONFIRMED',
    Enabled: true,
    Attributes: [
      { Name: 'sub', Value: sub },
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: emailVerified },
    ],
    ...overrides,
  };
}

function installFakeCognito(pages: UserType[][]): { pagesRead: () => number } {
  let pagesRead = 0;
  const sender = cognitoClient as unknown as { send: () => Promise<unknown> };
  mock.method(sender, 'send', async () => {
    const pageIndex = pagesRead;
    pagesRead += 1;
    return {
      Users: pages[pageIndex],
      PaginationToken: pageIndex + 1 < pages.length ? `page-${pageIndex + 1}` : undefined,
    };
  });
  return { pagesRead: () => pagesRead };
}

function movieRow(tmdbId: number, hasFile: boolean): FakeLibraryRow {
  return { pk: `movie#${tmdbId}`, mediaType: 'movie', title: `Movie ${tmdbId}`, tmdbId, hasFile };
}

function activeRequest(status: RequestStatus, userId: string): MediaRequest {
  return {
    requestId: `request-${userId}`,
    userId,
    userName: 'private-member@example.com',
    mediaType: 'movie',
    tmdbId: 603,
    title: 'The Matrix',
    year: '1999',
    overview: '',
    posterPath: '',
    status,
    requestedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const createPayload = {
  op: 'createRequest',
  userId: USER_ID,
  email: 'member@example.com',
  tmdbId: 603,
  title: 'The Matrix',
  year: '1999',
  overview: 'A hacker learns the truth.',
  posterPath: '/matrix.jpg',
};

describe('integration lambda', () => {
  beforeEach(() => {
    mock.method(console, 'error', () => undefined);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('input', () => {
    const invalidEvents: Array<[string, unknown]> = [
      ['null event', null],
      ['array event', []],
      ['string event', 'findUser'],
      ['missing op', {}],
      ['unknown op', { op: 'deleteEverything' }],
      ['inherited op name', { op: 'constructor' }],
      ['findUser without email', { op: 'findUser' }],
      ['findUser with a non-email', { op: 'findUser', email: 'not-an-email' }],
      ['findUser with a spaced email', { op: 'findUser', email: ' a@b.com' }],
      ['findUser with an object email', { op: 'findUser', email: { $ne: '' } }],
      ['findUser with a huge email', { op: 'findUser', email: `${'a'.repeat(300)}@b.com` }],
      ['movieStatus with a string id', { op: 'movieStatus', tmdbId: '603', userId: USER_ID }],
      ['movieStatus with a zero id', { op: 'movieStatus', tmdbId: 0, userId: USER_ID }],
      ['movieStatus with a fractional id', { op: 'movieStatus', tmdbId: 1.5, userId: USER_ID }],
      ['movieStatus without a user', { op: 'movieStatus', tmdbId: 603 }],
      ['movieStatus with a bad user', { op: 'movieStatus', tmdbId: 603, userId: 'a b' }],
      ['createRequest without a user', { ...createPayload, userId: undefined }],
      ['createRequest without an email', { ...createPayload, email: undefined }],
      ['createRequest with a blank title', { ...createPayload, title: '  ' }],
      ['createRequest with a bad year', { ...createPayload, year: 'soon' }],
      ['createRequest with a long overview', { ...createPayload, overview: 'x'.repeat(5001) }],
      ['createRequest with an http poster', { ...createPayload, posterPath: 'http://x.test/a.jpg' }],
      ['createRequest with a script poster', { ...createPayload, posterPath: 'javascript:alert(1)' }],
    ];

    for (const [name, event] of invalidEvents) {
      it(`rejects ${name}`, async () => {
        const state = createFakeState();
        installFakeDynamo(state);
        const response = await handler(event);
        assert.equal(response.ok, false);
        assert.equal(!response.ok && response.error, 'INVALID_INPUT');
        assert.equal(state.requests.length, 0);
      });
    }
  });

  describe('findUser', () => {
    it('matches regardless of case and returns only id and email', async () => {
      installFakeCognito([[
        cognitoUser('other-user', 'other@example.com'),
        cognitoUser(USER_ID, 'Member@Example.com'),
      ]]);
      const response = await handler({ op: 'findUser', email: 'member@EXAMPLE.com' });
      assert.deepEqual(response, { ok: true, data: { userId: USER_ID, email: 'Member@Example.com' } });
    });

    it('searches every page of the pool', async () => {
      const cognito = installFakeCognito([
        [cognitoUser('other-user', 'other@example.com')],
        [cognitoUser(USER_ID, 'member@example.com')],
      ]);
      const response = await handler({ op: 'findUser', email: 'member@example.com' });
      assert.deepEqual(response, { ok: true, data: { userId: USER_ID, email: 'member@example.com' } });
      assert.equal(cognito.pagesRead(), 2);
    });

    const excluded: Array<[string, UserType]> = [
      ['an unconfirmed user', cognitoUser(USER_ID, 'member@example.com', { UserStatus: 'UNCONFIRMED' })],
      ['a user who must reset', cognitoUser(USER_ID, 'member@example.com', { UserStatus: 'RESET_REQUIRED' })],
      ['a disabled user', cognitoUser(USER_ID, 'member@example.com', { Enabled: false })],
      ['an unverified email', cognitoUser(USER_ID, 'member@example.com', {}, 'false')],
      ['a partial match', cognitoUser(USER_ID, 'amember@example.com')],
    ];

    for (const [name, user] of excluded) {
      it(`returns null for ${name}`, async () => {
        installFakeCognito([[user]]);
        const response = await handler({ op: 'findUser', email: 'member@example.com' });
        assert.deepEqual(response, { ok: true, data: null });
      });
    }

    it('returns null when two accounts differ only by case', async () => {
      installFakeCognito([[
        cognitoUser('first-user', 'member@example.com'),
        cognitoUser('second-user', 'MEMBER@example.com'),
      ]]);
      const response = await handler({ op: 'findUser', email: 'member@example.com' });
      assert.deepEqual(response, { ok: true, data: null });
    });

    it('ignores an unconfirmed lookalike of a real account', async () => {
      installFakeCognito([[
        cognitoUser(USER_ID, 'member@example.com'),
        cognitoUser('lookalike', 'MEMBER@example.com', { UserStatus: 'UNCONFIRMED' }),
      ]]);
      const response = await handler({ op: 'findUser', email: 'member@example.com' });
      assert.deepEqual(response, { ok: true, data: { userId: USER_ID, email: 'member@example.com' } });
    });
  });

  describe('libraryMovies', () => {
    it('returns only tmdbId and hasFile for movies, across pages', async () => {
      installFakeDynamo(createFakeState({
        library: [
          movieRow(603, true),
          { pk: 'tv#121361', mediaType: 'tv', title: 'A Show', tvdbId: 121361, hasFile: false },
          movieRow(604, false),
        ],
        libraryPageSize: 1,
      }));
      const response = await handler({ op: 'libraryMovies' });
      assert.deepEqual(response, {
        ok: true,
        data: [{ tmdbId: 603, hasFile: true }, { tmdbId: 604, hasFile: false }],
      });
    });

    it('skips rows Radarr has no TMDB id for', async () => {
      installFakeDynamo(createFakeState({ library: [movieRow(0, true), movieRow(603, true)] }));
      const response = await handler({ op: 'libraryMovies' });
      assert.deepEqual(response, { ok: true, data: [{ tmdbId: 603, hasFile: true }] });
    });
  });

  describe('movieStatus', () => {
    const statusEvent = { op: 'movieStatus', tmdbId: 603, userId: USER_ID };

    it('reports a title outside the library with no request', async () => {
      installFakeDynamo(createFakeState());
      assert.deepEqual(await handler(statusEvent), {
        ok: true,
        data: { inLibrary: false, hasFile: false, activeRequest: null },
      });
    });

    it('reports a title with a file', async () => {
      installFakeDynamo(createFakeState({ library: [movieRow(603, true)] }));
      assert.deepEqual(await handler(statusEvent), {
        ok: true,
        data: { inLibrary: true, hasFile: true, activeRequest: null },
      });
    });

    it('reports a monitored title without a file', async () => {
      installFakeDynamo(createFakeState({ library: [movieRow(603, false)] }));
      assert.deepEqual(await handler(statusEvent), {
        ok: true,
        data: { inLibrary: true, hasFile: false, activeRequest: null },
      });
    });

    it('does not mistake a show with the same number for the movie', async () => {
      installFakeDynamo(createFakeState({
        library: [{ pk: 'tv#603', mediaType: 'tv', title: 'A Show', tvdbId: 603, hasFile: true }],
      }));
      assert.deepEqual(await handler(statusEvent), {
        ok: true,
        data: { inLibrary: false, hasFile: false, activeRequest: null },
      });
    });

    it("reports someone else's active request without saying who", async () => {
      installFakeDynamo(createFakeState({ requests: [activeRequest('approved', 'other-user')] }));
      const response = await handler(statusEvent);
      assert.deepEqual(response, {
        ok: true,
        data: {
          inLibrary: false,
          hasFile: false,
          activeRequest: { status: 'approved', requestedByUser: false },
        },
      });
      assert.equal(JSON.stringify(response).includes('private-member'), false);
    });

    it("prefers the caller's own request", async () => {
      installFakeDynamo(createFakeState({
        requests: [activeRequest('requested', 'other-user'), activeRequest('downloading', USER_ID)],
      }));
      assert.deepEqual(await handler(statusEvent), {
        ok: true,
        data: {
          inLibrary: false,
          hasFile: false,
          activeRequest: { status: 'downloading', requestedByUser: true },
        },
      });
    });

    it('ignores finished requests', async () => {
      installFakeDynamo(createFakeState({ requests: [activeRequest('complete', USER_ID)] }));
      assert.deepEqual(await handler(statusEvent), {
        ok: true,
        data: { inLibrary: false, hasFile: false, activeRequest: null },
      });
    });
  });

  describe('createRequest', () => {
    const trusted = [{ userId: USER_ID, autoApprove: true, updatedAt: '2026-01-01T00:00:00.000Z' }];

    it('stores a pending movie request for an untrusted user', async () => {
      const state = createFakeState();
      installFakeDynamo(state);
      const radarr = installFakeRadarr();

      const response = await handler(createPayload);

      assert.equal(radarr.calls.length, 0);
      assert.equal(state.requests.length, 1);
      const stored = state.requests[0];
      assert.deepEqual(response, {
        ok: true,
        data: { outcome: 'created', requestId: stored.requestId, status: 'requested', autoApproved: false },
      });
      assert.equal(stored.userId, USER_ID);
      assert.equal(stored.userName, 'member@example.com');
      assert.equal(stored.mediaType, 'movie');
      assert.equal(stored.title, 'The Matrix');
    });

    it('turns a TMDB poster path into a full URL and keeps an https one', async () => {
      const state = createFakeState();
      installFakeDynamo(state);

      await handler(createPayload);
      await handler({ ...createPayload, tmdbId: 604, posterPath: 'https://image.example/a.jpg' });
      await handler({ ...createPayload, tmdbId: 605, posterPath: null });

      assert.equal(state.requests[0].posterPath, 'https://image.tmdb.org/t/p/w500/matrix.jpg');
      assert.equal(state.requests[1].posterPath, 'https://image.example/a.jpg');
      assert.equal(state.requests[2].posterPath, '');
    });

    it('accepts a numeric year, or none', async () => {
      const state = createFakeState();
      installFakeDynamo(state);

      await handler({ ...createPayload, year: 1999 });
      await handler({ ...createPayload, tmdbId: 604, year: undefined });

      assert.equal(state.requests[0].year, '1999');
      assert.equal(state.requests[1].year, '');
    });

    it('auto-approves a trusted user', async () => {
      const state = createFakeState({ preferences: trusted });
      installFakeDynamo(state);
      const radarr = installFakeRadarr();

      const response = await handler(createPayload);

      assert.deepEqual(response, {
        ok: true,
        data: {
          outcome: 'created',
          requestId: state.requests[0].requestId,
          status: 'approved',
          autoApproved: true,
        },
      });
      assert.equal(state.requests[0].radarrId, 77);
      assert.ok(radarr.calls.some((call) => call.method === 'POST'));
    });

    it('falls back to manual approval, keeping the Radarr error private', async () => {
      const state = createFakeState({ preferences: trusted });
      installFakeDynamo(state);
      installFakeRadarr({ failing: true });

      const response = await handler(createPayload);

      assert.deepEqual(response, {
        ok: true,
        data: {
          outcome: 'created',
          requestId: state.requests[0].requestId,
          status: 'requested',
          autoApproved: false,
        },
      });
      assert.equal(state.requests[0].adminNote, 'Auto-approve failed: Radarr API error 500: radarr exploded');
      assert.equal(JSON.stringify(response).includes('radarr exploded'), false);
    });

    it('reports a duplicate without storing or approving', async () => {
      const state = createFakeState({
        preferences: trusted,
        requests: [activeRequest('requested', 'other-user')],
      });
      installFakeDynamo(state);
      const radarr = installFakeRadarr();

      const response = await handler(createPayload);

      assert.deepEqual(response, { ok: true, data: { outcome: 'duplicate' } });
      assert.equal(state.requests.length, 1);
      assert.equal(radarr.calls.length, 0);
    });

    it('cannot be turned into a TV request or carry seasons', async () => {
      const state = createFakeState();
      installFakeDynamo(state);

      await handler({ ...createPayload, mediaType: 'tv', seasons: [1] });

      assert.equal(state.requests[0].mediaType, 'movie');
      assert.equal('seasons' in state.requests[0], false);
    });
  });

  describe('failures', () => {
    it('answers with a generic error and no internal detail', async () => {
      const leakyError = new Error(`connect failed ${RADARR_SETTING.baseUrl} ${RADARR_SETTING.apiKey}`);
      installFakeDynamo(createFakeState({ failWith: leakyError }));

      const response = await handler({ op: 'libraryMovies' });

      assert.deepEqual(response, {
        ok: false,
        error: 'INTERNAL_ERROR',
        message: 'Plex Request could not complete the operation',
      });
    });

    it('never exposes integration settings from a successful call', async () => {
      const state = createFakeState({
        preferences: [{ userId: USER_ID, autoApprove: true, updatedAt: '2026-01-01T00:00:00.000Z' }],
      });
      installFakeDynamo(state);
      installFakeRadarr();

      const serialised = JSON.stringify(await handler(createPayload));

      assert.equal(serialised.includes(RADARR_SETTING.apiKey), false);
      assert.equal(serialised.includes(RADARR_SETTING.baseUrl), false);
    });
  });
});

import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { handleApproval } from '../lib/approval';
import { docClient } from '../lib/dynamodb';
import { addSeries } from '../lib/integrations/sonarr';
import type { IntegrationSetting, MediaRequest } from '../types';

const REQUESTED_TVDB_ID = 121361;

const SONARR_SETTING: IntegrationSetting = {
  settingKey: 'sonarr',
  baseUrl: 'http://sonarr.test',
  apiKey: 'sonarr-secret-key',
  enabled: true,
  qualityProfileId: 4,
  rootFolderPath: '/tv',
};

const SONARR_CONFIG = { baseUrl: SONARR_SETTING.baseUrl, apiKey: SONARR_SETTING.apiKey };

interface FakeSeries {
  tvdbId: number;
  tmdbId?: number;
  title: string;
  seasons?: Array<{ seasonNumber: number; monitored: boolean }>;
}

const requestedShow: FakeSeries = {
  tvdbId: REQUESTED_TVDB_ID,
  tmdbId: 1399,
  title: 'Game of Thrones',
  seasons: [{ seasonNumber: 1, monitored: false }, { seasonNumber: 2, monitored: false }],
};

// Its TMDB id equals the requested TVDB id: the old lookup accepted this show
const wrongShow: FakeSeries = {
  tvdbId: 999001,
  tmdbId: REQUESTED_TVDB_ID,
  title: 'Some Other Show',
};

const sameTitleWrongShow: FakeSeries = { tvdbId: 999002, title: requestedShow.title };

function tvRequest(overrides: Partial<MediaRequest> = {}): MediaRequest {
  return {
    requestId: 'request-1',
    userId: 'user-1',
    userName: 'member@example.com',
    mediaType: 'tv',
    tmdbId: REQUESTED_TVDB_ID,
    title: requestedShow.title,
    year: '2011',
    overview: '',
    posterPath: '',
    status: 'requested',
    requestedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

interface FakeSonarr {
  lookupTerms: string[];
  added: Array<Record<string, unknown>>;
}

function installFakeSonarr(lookupResults: FakeSeries[], librarySeries: unknown[] = []): FakeSonarr {
  const sonarr: FakeSonarr = { lookupTerms: [], added: [] };
  mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.pathname === '/api/v3/series/lookup') {
      sonarr.lookupTerms.push(parsedUrl.searchParams.get('term') ?? '');
      return Response.json(lookupResults);
    }
    if (parsedUrl.pathname === '/api/v3/series' && init?.method === 'POST') {
      sonarr.added.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return Response.json({ id: 55 });
    }
    if (parsedUrl.pathname === '/api/v3/series') {
      return Response.json(librarySeries);
    }
    throw new Error(`Unexpected Sonarr call ${url}`);
  });
  return sonarr;
}

function installSonarrSetting(): void {
  const sender = docClient as unknown as { send: () => Promise<unknown> };
  mock.method(sender, 'send', async () => ({ Item: SONARR_SETTING }));
}

describe('Sonarr approval', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('looks the show up by TVDB id, never by TMDB id', async () => {
    installSonarrSetting();
    const sonarr = installFakeSonarr([requestedShow]);

    const result = await handleApproval(tvRequest());

    assert.deepEqual(result, { sonarrId: 55 });
    assert.ok(sonarr.lookupTerms.length > 0);
    for (const term of sonarr.lookupTerms) {
      assert.equal(term, `tvdb:${REQUESTED_TVDB_ID}`);
    }
  });

  it('adds the requested show when a wrong show is listed first', async () => {
    installSonarrSetting();
    const sonarr = installFakeSonarr([wrongShow, sameTitleWrongShow, requestedShow]);

    await handleApproval(tvRequest());

    assert.equal(sonarr.added.length, 1);
    assert.equal(sonarr.added[0].tvdbId, REQUESTED_TVDB_ID);
    assert.equal(sonarr.added[0].title, requestedShow.title);
  });

  it('does not accept a show whose TMDB id equals the requested id', async () => {
    installSonarrSetting();
    const sonarr = installFakeSonarr([wrongShow]);

    await assert.rejects(handleApproval(tvRequest()), /TVDB ID 121361/);

    assert.equal(sonarr.added.length, 0);
  });

  it('does not accept a different show with the same title', async () => {
    installSonarrSetting();
    const sonarr = installFakeSonarr([sameTitleWrongShow]);

    await assert.rejects(handleApproval(tvRequest()), /TVDB ID 121361/);

    assert.equal(sonarr.added.length, 0);
  });

  it('fails when Sonarr finds nothing', async () => {
    installSonarrSetting();
    const sonarr = installFakeSonarr([]);

    await assert.rejects(handleApproval(tvRequest()), /TVDB ID 121361/);

    assert.equal(sonarr.added.length, 0);
  });

  it('keeps the requested seasons on the show it adds', async () => {
    installSonarrSetting();
    const sonarr = installFakeSonarr([requestedShow]);

    await handleApproval(tvRequest({ seasons: [2] }));

    assert.deepEqual(sonarr.added[0].seasons, [
      { seasonNumber: 1, monitored: false },
      { seasonNumber: 2, monitored: true },
    ]);
  });

  it('refuses seasons Sonarr does not have, rather than monitoring nothing', async () => {
    installSonarrSetting();
    const sonarr = installFakeSonarr([requestedShow]);

    await assert.rejects(handleApproval(tvRequest({ seasons: [7] })), /None of seasons 7/);

    assert.equal(sonarr.added.length, 0);
  });

  it('reuses a show Sonarr already has without adding it again', async () => {
    installSonarrSetting();
    const sonarr = installFakeSonarr([requestedShow], [{ id: 12, tvdbId: REQUESTED_TVDB_ID }]);

    const result = await handleApproval(tvRequest());

    assert.deepEqual(result, { sonarrId: 12 });
    assert.equal(sonarr.added.length, 0);
  });
});

describe('addSeries', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('adds the show with the requested TVDB id, not the first result', async () => {
    const sonarr = installFakeSonarr([wrongShow, requestedShow]);

    await addSeries(SONARR_CONFIG, REQUESTED_TVDB_ID, 4, '/tv');

    assert.equal(sonarr.added[0].tvdbId, REQUESTED_TVDB_ID);
  });

  it('refuses to add anything when no result has the requested TVDB id', async () => {
    const sonarr = installFakeSonarr([wrongShow]);

    await assert.rejects(addSeries(SONARR_CONFIG, REQUESTED_TVDB_ID, 4, '/tv'), /TVDB ID 121361/);

    assert.equal(sonarr.added.length, 0);
  });
});

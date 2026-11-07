import { mock } from 'node:test';
import {
  docClient,
  LIBRARY_TABLE,
  REQUESTS_TABLE,
  SETTINGS_TABLE,
  USER_PREFERENCES_TABLE,
} from '../lib/dynamodb';
import type { IntegrationSetting, MediaRequest, UserPreference } from '../types';

interface SentCommand {
  input: Record<string, unknown>;
}

export interface FakeLibraryRow {
  pk: string;
  mediaType: string;
  title: string;
  tmdbId?: number;
  tvdbId?: number;
  hasFile: boolean;
}

export interface FakeState {
  requests: MediaRequest[];
  preferences: UserPreference[];
  settings: IntegrationSetting[];
  library: FakeLibraryRow[];
  libraryPageSize: number;
  statusQueries: string[];
  failWith?: Error;
}

export const RADARR_SETTING: IntegrationSetting = {
  settingKey: 'radarr',
  baseUrl: 'http://radarr.test',
  apiKey: 'radarr-secret-key',
  enabled: true,
  qualityProfileId: 4,
  rootFolderPath: '/movies',
};

export function createFakeState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    requests: [],
    preferences: [],
    settings: [RADARR_SETTING],
    library: [],
    libraryPageSize: 1000,
    statusQueries: [],
    ...overrides,
  };
}

function runGet(state: FakeState, input: Record<string, unknown>): { Item?: unknown } {
  const key = input.Key as Record<string, string>;
  switch (input.TableName) {
    case USER_PREFERENCES_TABLE:
      return { Item: state.preferences.find((preference) => preference.userId === key.userId) };
    case SETTINGS_TABLE:
      return { Item: state.settings.find((setting) => setting.settingKey === key.settingKey) };
    case LIBRARY_TABLE:
      return { Item: state.library.find((row) => row.pk === key.pk) };
    default:
      throw new Error(`Unexpected GetCommand table ${String(input.TableName)}`);
  }
}

function runStatusQuery(state: FakeState, input: Record<string, unknown>): { Items: MediaRequest[] } {
  if (input.TableName !== REQUESTS_TABLE || input.IndexName !== 'StatusIndex') {
    throw new Error('Unexpected QueryCommand');
  }
  const values = input.ExpressionAttributeValues as Record<string, unknown>;
  state.statusQueries.push(values[':status'] as string);
  return {
    Items: state.requests.filter(
      (request) =>
        request.status === values[':status'] &&
        request.tmdbId === values[':tmdbId'] &&
        request.mediaType === values[':mediaType']
    ),
  };
}

function runLibraryScan(
  state: FakeState,
  input: Record<string, unknown>
): { Items: unknown[]; LastEvaluatedKey?: Record<string, unknown> } {
  if (input.TableName !== LIBRARY_TABLE) {
    throw new Error('Unexpected ScanCommand');
  }
  const startKey = input.ExclusiveStartKey as { offset: number } | undefined;
  const offset = startKey?.offset ?? 0;
  const end = offset + state.libraryPageSize;
  const values = input.ExpressionAttributeValues as Record<string, unknown> | undefined;
  const page = state.library
    .slice(offset, end)
    .filter((row) => !values || row.mediaType === values[':mediaType']);
  const fields = String(input.ProjectionExpression).split(', ') as Array<keyof FakeLibraryRow>;
  return {
    Items: page.map((row) => Object.fromEntries(fields.map((field) => [field, row[field]]))),
    ...(end < state.library.length ? { LastEvaluatedKey: { offset: end } } : {}),
  };
}

export function installFakeDynamo(state: FakeState): void {
  const sender = docClient as unknown as { send: (command: SentCommand) => Promise<unknown> };
  mock.method(sender, 'send', async (command: SentCommand) => {
    if (state.failWith) {
      throw state.failWith;
    }
    const commandName = command.constructor.name;
    switch (commandName) {
      case 'GetCommand':
        return runGet(state, command.input);
      case 'QueryCommand':
        return runStatusQuery(state, command.input);
      case 'ScanCommand':
        return runLibraryScan(state, command.input);
      case 'PutCommand':
        state.requests.push(command.input.Item as MediaRequest);
        return {};
      default:
        throw new Error(`Unexpected command ${commandName}`);
    }
  });
}

export interface FakeRadarr {
  calls: Array<{ method: string; url: string }>;
}

export function installFakeRadarr(options: { failing?: boolean } = {}): FakeRadarr {
  const radarr: FakeRadarr = { calls: [] };
  mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    radarr.calls.push({ method, url });
    if (options.failing) {
      return new Response('radarr exploded', { status: 500 });
    }
    if (method === 'POST') {
      return Response.json({ id: 77 });
    }
    if (url.includes('/api/v3/movie?tmdbId=')) {
      return Response.json([]);
    }
    return Response.json({ tmdbId: 603, title: 'The Matrix', year: 1999 });
  });
  return radarr;
}

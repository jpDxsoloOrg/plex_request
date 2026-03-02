import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  type GetCommandInput,
  type PutCommandInput,
  type UpdateCommandInput,
  type DeleteCommandInput,
  type QueryCommandInput,
  type ScanCommandInput,
} from '@aws-sdk/lib-dynamodb';

const isOffline = process.env.IS_OFFLINE === 'true';

const client = new DynamoDBClient(
  isOffline
    ? {
        region: 'localhost',
        endpoint: 'http://localhost:8000',
        credentials: {
          accessKeyId: 'LOCAL',
          secretAccessKey: 'LOCAL',
        },
      }
    : {}
);

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

export async function getItem(params: GetCommandInput) {
  const result = await docClient.send(new GetCommand(params));
  return result.Item;
}

export async function putItem(params: PutCommandInput) {
  await docClient.send(new PutCommand(params));
}

export async function updateItem(params: UpdateCommandInput) {
  const result = await docClient.send(new UpdateCommand(params));
  return result.Attributes;
}

export async function deleteItem(params: DeleteCommandInput) {
  await docClient.send(new DeleteCommand(params));
}

export async function query(params: QueryCommandInput) {
  const result = await docClient.send(new QueryCommand(params));
  return result.Items ?? [];
}

export async function queryCount(params: Omit<QueryCommandInput, 'Select'>) {
  const result = await docClient.send(new QueryCommand({ ...params, Select: 'COUNT' }));
  return result.Count ?? 0;
}

export async function scan(params: ScanCommandInput) {
  const result = await docClient.send(new ScanCommand(params));
  return result.Items ?? [];
}

export const REQUESTS_TABLE = process.env.REQUESTS_TABLE ?? 'plex-request-api-dev-requests';
export const SETTINGS_TABLE = process.env.SETTINGS_TABLE ?? 'plex-request-api-dev-settings';

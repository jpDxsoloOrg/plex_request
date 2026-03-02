import type { APIGatewayProxyResult } from 'aws-lambda';

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
};

export function success(body: unknown, statusCode = 200): APIGatewayProxyResult {
  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify(body),
  };
}

export function created(body: unknown): APIGatewayProxyResult {
  return success(body, 201);
}

export function noContent(): APIGatewayProxyResult {
  return {
    statusCode: 204,
    headers: defaultHeaders,
    body: '',
  };
}

export function badRequest(message: string): APIGatewayProxyResult {
  return {
    statusCode: 400,
    headers: defaultHeaders,
    body: JSON.stringify({ error: message }),
  };
}

export function unauthorized(message = 'Unauthorized'): APIGatewayProxyResult {
  return {
    statusCode: 401,
    headers: defaultHeaders,
    body: JSON.stringify({ error: message }),
  };
}

export function forbidden(message = 'Forbidden'): APIGatewayProxyResult {
  return {
    statusCode: 403,
    headers: defaultHeaders,
    body: JSON.stringify({ error: message }),
  };
}

export function notFound(message = 'Not found'): APIGatewayProxyResult {
  return {
    statusCode: 404,
    headers: defaultHeaders,
    body: JSON.stringify({ error: message }),
  };
}

export function conflict(message: string): APIGatewayProxyResult {
  return {
    statusCode: 409,
    headers: defaultHeaders,
    body: JSON.stringify({ error: message }),
  };
}

export function serverError(message = 'Internal server error'): APIGatewayProxyResult {
  return {
    statusCode: 500,
    headers: defaultHeaders,
    body: JSON.stringify({ error: message }),
  };
}

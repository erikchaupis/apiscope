import type { Endpoint } from '../core/types';
import type { RequestBody } from '../core/requestBody';
import { buildExpressRequestBody } from './bodyBuilder/ExpressRequestBodyBuilder';
import { buildFastApiRequestBody } from './bodyBuilder/FastApiRequestBodyBuilder';
import { buildSpringRequestBody } from './bodyBuilder/SpringRequestBodyBuilder';

export interface GeneratedRequestBody {
  body?: string;
  requestBody?: RequestBody;
}

export function buildExampleRequestBody(
  endpoint: Endpoint,
  framework = 'spring'
): GeneratedRequestBody | undefined {
  if (endpoint.method === 'GET' || endpoint.method === 'DELETE') {
    return undefined;
  }

  switch (framework) {
    case 'fastapi':
      return buildFastApiRequestBody(endpoint);
    case 'express':
      return buildExpressRequestBody(endpoint);
    case 'spring':
    default:
      return buildSpringRequestBody(endpoint);
  }
}

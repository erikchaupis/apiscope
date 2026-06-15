import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import type FormData from 'form-data';
import { validateMultipartFiles } from '../core/requestBody';
import { isBinaryResponse } from '../core/fileResponse';
import { ApiRequest, ApiResponse, AuthState, RequestHeader } from '../core/types';
import { mergeAuthHeaders } from '../authentication/AuthState';
import { resolveEffectiveAuthState } from '../authentication/requestAuthorization';
import { createDownloadWriteStream } from '../storage/DownloadStorage';
import {
  buildMultipartForm,
  getTextRequestBody,
  prepareMultipartHeaders,
  shouldUseMultipart,
  shouldUseUrlEncoded,
} from './executeRequestBody';

export interface ExecuteRequestOptions {
  workspaceRoot?: string;
  requestUrl?: string;
  /** When false, binary downloads are stored in `.apiscope/downloads/.temp/` only. */
  persistDownloads?: boolean;
}

export function buildDefaultHeaders(): RequestHeader[] {
  return [
    { key: 'Accept', value: 'application/json', enabled: true },
    { key: 'Content-Type', value: 'application/json', enabled: true },
  ];
}

export async function executeRequest(
  request: ApiRequest,
  auth: AuthState | null,
  options?: ExecuteRequestOptions
): Promise<ApiResponse> {
  const url = new URL(request.url);
  const enabledParams = request.queryParams.filter((p) => p.enabled && p.key);
  for (const param of enabledParams) {
    url.searchParams.set(param.key, param.value);
  }

  const headers: Record<string, string> = {};
  for (const h of request.headers.filter((x) => x.enabled && x.key)) {
    headers[h.key] = h.value;
  }

  const effectiveAuth = resolveEffectiveAuthState(request.authorization, auth);
  const merged = mergeAuthHeaders(url, headers, effectiveAuth);
  const collectOptions = {
    workspaceRoot: options?.workspaceRoot,
    requestUrl: options?.requestUrl ?? merged.url.toString(),
    persistDownloads: options?.persistDownloads,
  };

  if (shouldUseMultipart(request)) {
    const validationError = validateMultipartFiles(request);
    if (validationError) {
      throw new Error(validationError);
    }
    const form = buildMultipartForm(request);
    const multipartHeaders = prepareMultipartHeaders(merged.headers, form);
    const start = Date.now();
    const response = await httpRequestWithStream(
      merged.url,
      request.method,
      multipartHeaders,
      form,
      collectOptions
    );
    return {
      statusCode: response.statusCode,
      statusText: response.statusMessage,
      headers: response.headers,
      body: response.body,
      durationMs: Date.now() - start,
      ...(response.fileResponse ? { fileResponse: response.fileResponse } : {}),
    };
  }

  let body = getTextRequestBody(request);
  const requestHeaders = { ...merged.headers };

  if (shouldUseUrlEncoded(request) && body) {
    if (!hasContentTypeHeader(requestHeaders)) {
      requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  } else if (body && !hasContentTypeHeader(requestHeaders)) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const start = Date.now();
  const response = await httpRequest(
    merged.url,
    request.method,
    requestHeaders,
    body,
    collectOptions
  );
  const durationMs = Date.now() - start;

  return {
    statusCode: response.statusCode,
    statusText: response.statusMessage,
    headers: response.headers,
    body: response.body,
    durationMs,
    ...(response.fileResponse ? { fileResponse: response.fileResponse } : {}),
  };
}

function hasContentTypeHeader(headers: Record<string, string>): boolean {
  return Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');
}

interface CollectedResponse {
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string>;
  body: string;
  fileResponse?: ApiResponse['fileResponse'];
}

interface CollectOptions {
  workspaceRoot?: string;
  requestUrl: string;
  persistDownloads?: boolean;
}

function httpRequest(
  url: URL,
  method: string,
  headers: Record<string, string>,
  body?: string,
  collectOptions?: CollectOptions
): Promise<CollectedResponse> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      { method, headers },
      (res) => {
        collectResponse(res, collectOptions).then(resolve).catch(reject);
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function httpRequestWithStream(
  url: URL,
  method: string,
  headers: Record<string, string>,
  body: FormData,
  collectOptions?: CollectOptions
): Promise<CollectedResponse> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      { method, headers },
      (res) => {
        collectResponse(res, collectOptions).then(resolve).catch(reject);
      }
    );
    req.on('error', reject);
    body.on('error', reject);
    body.pipe(req);
  });
}

function normalizeResponseHeaders(res: http.IncomingMessage): Record<string, string> {
  const responseHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(res.headers)) {
    if (typeof value === 'string') {
      responseHeaders[key] = value;
    } else if (Array.isArray(value)) {
      responseHeaders[key] = value.join(', ');
    }
  }
  return responseHeaders;
}

async function collectResponse(
  res: http.IncomingMessage,
  collectOptions?: CollectOptions
): Promise<CollectedResponse> {
  const responseHeaders = normalizeResponseHeaders(res);
  const statusCode = res.statusCode ?? 0;
  const statusMessage = res.statusMessage ?? '';

  const shouldStoreBinary =
    Boolean(collectOptions?.workspaceRoot) && isBinaryResponse(responseHeaders);

  if (shouldStoreBinary && collectOptions?.workspaceRoot) {
    const download = createDownloadWriteStream({
      workspaceRoot: collectOptions.workspaceRoot,
      headers: responseHeaders,
      requestUrl: collectOptions.requestUrl,
      persist: collectOptions.persistDownloads === true,
    });

    await new Promise<void>((resolve, reject) => {
      res.pipe(download.stream);
      download.stream.on('finish', () => resolve());
      download.stream.on('error', reject);
      res.on('error', reject);
    });

    return {
      statusCode,
      statusMessage,
      headers: responseHeaders,
      body: '',
      fileResponse: download.finalize(),
    };
  }

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => resolve());
    res.on('error', reject);
  });

  const raw = Buffer.concat(chunks).toString('utf-8');
  return {
    statusCode,
    statusMessage,
    headers: responseHeaders,
    body: raw,
  };
}

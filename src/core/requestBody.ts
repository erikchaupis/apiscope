import * as fs from 'fs';
import * as path from 'path';
import type { ApiRequest, KeyValuePair } from './types';

export type RequestBodyKind = 'none' | 'json' | 'form-urlencoded' | 'raw' | 'multipart';

export type MultipartFieldType = 'text' | 'file';

export interface MultipartTextField {
  key: string;
  type: 'text';
  value: string;
  enabled: boolean;
}

export interface MultipartFileField {
  key: string;
  type: 'file';
  filePath: string;
  fileName?: string;
  fileSize?: number;
  enabled: boolean;
}

export type MultipartFormField = MultipartTextField | MultipartFileField;

export interface RequestBody {
  kind: RequestBodyKind;
  content?: string;
  urlEncoded?: KeyValuePair[];
  formData?: MultipartFormField[];
}

export function defaultRequestBody(): RequestBody {
  return { kind: 'none' };
}

export function normalizeRequestBody(
  request: Pick<ApiRequest, 'body' | 'requestBody'>
): RequestBody {
  if (request.requestBody) {
    return request.requestBody;
  }
  if (request.body?.trim()) {
    try {
      JSON.parse(request.body);
      return { kind: 'json', content: request.body };
    } catch {
      return { kind: 'raw', content: request.body };
    }
  }
  return defaultRequestBody();
}

export function getRequestBodyKind(request: Pick<ApiRequest, 'body' | 'requestBody'>): RequestBodyKind {
  return normalizeRequestBody(request).kind;
}

export function syncRequestBodyFields(request: ApiRequest): ApiRequest {
  const requestBody = normalizeRequestBody(request);
  if (requestBody.kind === 'json' || requestBody.kind === 'raw') {
    return {
      ...request,
      requestBody,
      body: requestBody.content ?? '',
    };
  }
  return {
    ...request,
    requestBody,
    body: undefined,
  };
}

export function createEmptyMultipartField(type: MultipartFieldType = 'text'): MultipartFormField {
  if (type === 'file') {
    return { key: '', type: 'file', filePath: '', enabled: true };
  }
  return { key: '', type: 'text', value: '', enabled: true };
}

export function multipartFileDisplayName(field: MultipartFileField): string {
  if (field.fileName?.trim()) {
    return field.fileName.trim();
  }
  if (field.filePath?.trim()) {
    return path.basename(field.filePath);
  }
  return '';
}

export function validateMultipartFiles(request: ApiRequest): string | null {
  const body = normalizeRequestBody(request);
  if (body.kind !== 'multipart') {
    return null;
  }

  for (const field of body.formData ?? []) {
    if (!field.enabled || !field.key.trim()) {
      continue;
    }
    if (field.type !== 'file') {
      continue;
    }
    if (!field.filePath?.trim()) {
      return `Missing file for field "${field.key}"`;
    }
    if (!fs.existsSync(field.filePath)) {
      return `Referenced file does not exist:\n${multipartFileDisplayName(field) || field.key}`;
    }
    try {
      fs.accessSync(field.filePath, fs.constants.R_OK);
    } catch {
      return `Referenced file is not readable:\n${multipartFileDisplayName(field) || field.key}`;
    }
  }

  return null;
}

export function stripConflictingContentType(headers: Record<string, string>): Record<string, string> {
  const next = { ...headers };
  for (const key of Object.keys(next)) {
    if (key.toLowerCase() === 'content-type') {
      delete next[key];
    }
  }
  return next;
}

export function collectRequestBodyText(request: ApiRequest): string[] {
  const body = normalizeRequestBody(request);
  const parts: string[] = [];
  if (body.content) {
    parts.push(body.content);
  }
  for (const row of body.urlEncoded ?? []) {
    parts.push(row.key, row.value);
  }
  for (const field of body.formData ?? []) {
    if (field.type === 'text') {
      parts.push(field.key, field.value);
    } else {
      parts.push(field.key, field.filePath);
    }
  }
  return parts;
}

import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import {
  MultipartFileField,
  MultipartFormField,
  normalizeRequestBody,
  stripConflictingContentType,
  validateMultipartFiles,
} from '../core/requestBody';
import type { ApiRequest } from '../core/types';

export function buildUrlEncodedBody(request: ApiRequest): string | undefined {
  const body = normalizeRequestBody(request);
  if (body.kind !== 'form-urlencoded') {
    return undefined;
  }

  const params = new URLSearchParams();
  for (const row of body.urlEncoded ?? []) {
    if (!row.enabled || !row.key.trim()) {
      continue;
    }
    params.append(row.key, row.value);
  }

  const encoded = params.toString();
  return encoded || undefined;
}

export function buildMultipartForm(request: ApiRequest): FormData {
  const validationError = validateMultipartFiles(request);
  if (validationError) {
    throw new Error(validationError);
  }

  const body = normalizeRequestBody(request);
  const form = new FormData();

  for (const field of body.formData ?? []) {
    appendMultipartField(form, field);
  }

  return form;
}

function appendMultipartField(form: FormData, field: MultipartFormField): void {
  if (!field.enabled || !field.key.trim()) {
    return;
  }

  if (field.type === 'text') {
    form.append(field.key, field.value);
    return;
  }

  appendMultipartFile(form, field);
}

function appendMultipartFile(form: FormData, field: MultipartFileField): void {
  const filePath = field.filePath.trim();
  if (!filePath) {
    return;
  }

  const fileName = field.fileName?.trim() || path.basename(filePath);
  form.append(field.key, fs.createReadStream(filePath), { filename: fileName });
}

export function prepareMultipartHeaders(
  headers: Record<string, string>,
  form: FormData
): Record<string, string> {
  const withoutContentType = stripConflictingContentType(headers);
  return {
    ...withoutContentType,
    ...form.getHeaders(),
  };
}

export function getTextRequestBody(request: ApiRequest): string | undefined {
  const body = normalizeRequestBody(request);
  if (request.method === 'GET') {
    return undefined;
  }

  if (body.kind === 'json' || body.kind === 'raw') {
    const content = body.content?.trim();
    return content || undefined;
  }

  if (body.kind === 'form-urlencoded') {
    return buildUrlEncodedBody(request);
  }

  return undefined;
}

export function shouldUseMultipart(request: ApiRequest): boolean {
  return normalizeRequestBody(request).kind === 'multipart';
}

export function shouldUseUrlEncoded(request: ApiRequest): boolean {
  return normalizeRequestBody(request).kind === 'form-urlencoded';
}

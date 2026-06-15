import type { ApiRequest, KeyValuePair, MultipartFieldType, MultipartFormField, RequestBody, RequestBodyKind } from '../types';

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

export function createEmptyMultipartField(type: MultipartFieldType = 'text'): MultipartFormField {
  if (type === 'file') {
    return { key: '', type: 'file', filePath: '', enabled: true };
  }
  return { key: '', type: 'text', value: '', enabled: true };
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

export function setRequestBodyKind(request: ApiRequest, kind: RequestBodyKind): ApiRequest {
  const current = normalizeRequestBody(request);
  const next: RequestBody = { kind };

  switch (kind) {
    case 'json':
    case 'raw':
      next.content =
        current.kind === kind
          ? current.content
          : current.content ?? request.body ?? (kind === 'json' ? '{\n  \n}' : '');
      break;
    case 'form-urlencoded':
      next.urlEncoded = current.urlEncoded ?? [{ key: '', value: '', enabled: true }];
      break;
    case 'multipart':
      next.formData = current.formData ?? [createEmptyMultipartField('text')];
      break;
    default:
      break;
  }

  return syncRequestBodyFields({ ...request, requestBody: next });
}

export function updateRequestBodyContent(request: ApiRequest, content: string): ApiRequest {
  const current = normalizeRequestBody(request);
  return syncRequestBodyFields({
    ...request,
    requestBody: { ...current, content },
  });
}

export function updateUrlEncodedBody(request: ApiRequest, urlEncoded: KeyValuePair[]): ApiRequest {
  const current = normalizeRequestBody(request);
  return syncRequestBodyFields({
    ...request,
    requestBody: { ...current, kind: 'form-urlencoded', urlEncoded },
  });
}

export function updateMultipartFormData(
  request: ApiRequest,
  formData: MultipartFormField[]
): ApiRequest {
  const current = normalizeRequestBody(request);
  return syncRequestBodyFields({
    ...request,
    requestBody: { ...current, kind: 'multipart', formData },
  });
}

export function multipartFileDisplayName(field: Extract<MultipartFormField, { type: 'file' }>): string {
  if (field.fileName?.trim()) {
    return field.fileName.trim();
  }
  if (field.filePath?.trim()) {
    const parts = field.filePath.split(/[/\\]/);
    return parts[parts.length - 1] ?? field.filePath;
  }
  return '';
}

export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || Number.isNaN(bytes)) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function collectUploadFilePaths(request: Pick<ApiRequest, 'body' | 'requestBody'>): string[] {
  const body = normalizeRequestBody(request);
  if (body.kind !== 'multipart') {
    return [];
  }
  return (body.formData ?? [])
    .filter((field): field is Extract<MultipartFormField, { type: 'file' }> => field.type === 'file')
    .map((field) => field.filePath)
    .filter(Boolean);
}

export function hasConflictingMultipartContentType(request: ApiRequest): boolean {
  const body = normalizeRequestBody(request);
  if (body.kind !== 'multipart') {
    return false;
  }
  return request.headers.some(
    (header) => header.enabled && header.key.trim().toLowerCase() === 'content-type'
  );
}

export const REQUEST_BODY_KIND_LABELS: Record<RequestBodyKind, string> = {
  none: 'None',
  json: 'JSON',
  'form-urlencoded': 'Form URL Encoded',
  raw: 'Raw',
  multipart: 'Multipart Form Data',
};

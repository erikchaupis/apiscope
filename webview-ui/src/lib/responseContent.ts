import { tryFormatJson } from './utils';

export function getContentType(headers: Record<string, string>): string {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === 'content-type');
  return entry?.[1]?.split(';')[0]?.trim().toLowerCase() ?? '';
}

export function isJsonContentType(headers: Record<string, string>): boolean {
  const contentType = getContentType(headers);
  if (!contentType) {
    return false;
  }
  return contentType === 'application/json' || contentType.endsWith('+json');
}

/** True when Content-Type indicates JSON or the body parses as JSON. */
export function isJsonResponse(headers: Record<string, string>, body: string): boolean {
  if (isJsonContentType(headers)) {
    return true;
  }
  return tryFormatJson(body).isJson;
}

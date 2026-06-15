import { AuthCookie } from '../core/types';

export function parseSetCookieHeaders(
  headers: string | string[] | undefined
): AuthCookie[] {
  if (!headers) {
    return [];
  }
  const list = Array.isArray(headers) ? headers : [headers];
  const cookies: AuthCookie[] = [];
  for (const header of list) {
    const part = header.split(';')[0]?.trim();
    if (!part) {
      continue;
    }
    const eq = part.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    cookies.push({
      name: part.slice(0, eq).trim(),
      value: part.slice(eq + 1).trim(),
    });
  }
  return cookies;
}

export function mergeCookies(existing: AuthCookie[], incoming: AuthCookie[]): AuthCookie[] {
  const map = new Map(existing.map((cookie) => [cookie.name, cookie]));
  for (const cookie of incoming) {
    map.set(cookie.name, cookie);
  }
  return Array.from(map.values());
}

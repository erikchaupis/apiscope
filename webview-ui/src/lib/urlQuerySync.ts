import type { KeyValuePair } from '../types';

/** Index of `?` starting the query string, ignoring `?` inside `{{templates}}`. */
export function findQueryStart(url: string): number {
  let inTemplate = false;
  for (let i = 0; i < url.length; i++) {
    if (url[i] === '{' && url[i + 1] === '{') {
      inTemplate = true;
      i++;
      continue;
    }
    if (url[i] === '}' && url[i + 1] === '}') {
      inTemplate = false;
      i++;
      continue;
    }
    if (url[i] === '?' && !inTemplate) {
      return i;
    }
  }
  return -1;
}

export function splitUrlAndQuery(url: string): { base: string; search: string } {
  const idx = findQueryStart(url);
  if (idx < 0) {
    return { base: url, search: '' };
  }
  return { base: url.slice(0, idx), search: url.slice(idx + 1) };
}

export function parseQueryString(search: string): KeyValuePair[] {
  if (!search) {
    return [];
  }

  const hashIdx = search.indexOf('#');
  const query = hashIdx >= 0 ? search.slice(0, hashIdx) : search;
  const pairs: KeyValuePair[] = [];

  for (const part of query.split('&')) {
    if (!part) {
      continue;
    }
    const eq = part.indexOf('=');
    const rawKey = eq >= 0 ? part.slice(0, eq) : part;
    const rawValue = eq >= 0 ? part.slice(eq + 1) : '';
    try {
      pairs.push({
        key: decodeURIComponent(rawKey.replace(/\+/g, ' ')),
        value: decodeURIComponent(rawValue.replace(/\+/g, ' ')),
        enabled: true,
      });
    } catch {
      pairs.push({ key: rawKey, value: rawValue, enabled: true });
    }
  }

  return pairs;
}

export function serializeQueryParams(params: KeyValuePair[]): string {
  const enabled = params.filter((p) => p.enabled && p.key);
  if (enabled.length === 0) {
    return '';
  }

  return enabled
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join('&');
}

export function buildUrlWithQueryParams(base: string, params: KeyValuePair[]): string {
  const search = serializeQueryParams(params);
  return search ? `${base}?${search}` : base;
}

/** URL edited → refresh query param rows (keep empty draft rows). */
export function syncQueryParamsFromUrl(url: string, existingParams: KeyValuePair[]): KeyValuePair[] {
  const { search } = splitUrlAndQuery(url);
  const parsed = parseQueryString(search);
  const draftRows = existingParams.filter((p) => !p.key.trim());
  return [...parsed, ...draftRows];
}

/** Query param table edited → rebuild URL query string on the same base. */
export function syncUrlFromQueryParams(url: string, params: KeyValuePair[]): string {
  const { base } = splitUrlAndQuery(url);
  return buildUrlWithQueryParams(base, params);
}

/** Align URL and query params when loading a stored request. */
export function normalizeRequestQuery<T extends { url: string; queryParams: KeyValuePair[] }>(
  request: T
): T {
  const { search } = splitUrlAndQuery(request.url);
  const hasUrlQuery = search.length > 0;
  const hasTableParams = request.queryParams.some((p) => p.key.trim());

  if (hasUrlQuery) {
    return {
      ...request,
      queryParams: syncQueryParamsFromUrl(request.url, request.queryParams),
    };
  }

  if (hasTableParams) {
    return {
      ...request,
      url: syncUrlFromQueryParams(request.url, request.queryParams),
    };
  }

  return request;
}

import { ApiResponse, EnvironmentVariable, PostRequestVariable } from './types';

export type PostVariablePreviewResult =
  | { status: 'ok'; value: string }
  | { status: 'no-response' }
  | { status: 'unresolved' };

function tokenizeJsonPath(path: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  let remaining = path.trim();
  while (remaining) {
    if (remaining.startsWith('.')) {
      remaining = remaining.slice(1);
      continue;
    }
    const bracket = remaining.match(/^\[(\d+)\]/);
    if (bracket) {
      tokens.push(Number(bracket[1]));
      remaining = remaining.slice(bracket[0].length);
      continue;
    }
    const ident = remaining.match(/^([a-zA-Z_]\w*)/);
    if (ident) {
      tokens.push(ident[1]);
      remaining = remaining.slice(ident[1].length);
      continue;
    }
    break;
  }
  return tokens;
}

export function resolveJsonPath(data: unknown, path: string): unknown {
  if (!path.trim()) {
    return undefined;
  }
  let current: unknown = data;
  for (const token of tokenizeJsonPath(path)) {
    if (current == null) {
      return undefined;
    }
    if (typeof token === 'number') {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[token];
      continue;
    }
    if (token === 'length') {
      if (Array.isArray(current) || typeof current === 'string') {
        current = current.length;
        continue;
      }
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

export function findResponseHeader(
  headers: Record<string, string>,
  headerName: string
): string | undefined {
  const target = headerName.trim().toLowerCase();
  if (!target) {
    return undefined;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value;
    }
  }
  return undefined;
}

export function collectSetCookieHeaders(headers: Record<string, string>): string[] {
  const cookies: string[] = [];
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'set-cookie' && value.trim()) {
      cookies.push(value);
    }
  }
  return cookies;
}

export function parseCookieFromSetCookie(setCookieValue: string, cookieName: string): string | undefined {
  const target = cookieName.trim().toLowerCase();
  if (!target) {
    return undefined;
  }
  const firstPart = setCookieValue.split(';')[0]?.trim();
  if (!firstPart) {
    return undefined;
  }
  const eq = firstPart.indexOf('=');
  if (eq <= 0) {
    return undefined;
  }
  const name = firstPart.slice(0, eq).trim();
  if (name.toLowerCase() !== target) {
    return undefined;
  }
  return firstPart.slice(eq + 1).trim();
}

export function findResponseCookie(
  headers: Record<string, string>,
  cookieName: string
): string | undefined {
  for (const header of collectSetCookieHeaders(headers)) {
    for (const part of header.split(/,(?=\s*[a-zA-Z_])/)) {
      const value = parseCookieFromSetCookie(part.trim(), cookieName);
      if (value !== undefined) {
        return value;
      }
    }
    const direct = parseCookieFromSetCookie(header, cookieName);
    if (direct !== undefined) {
      return direct;
    }
  }
  return undefined;
}

function valueToString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

export function extractPostRequestVariable(
  variable: PostRequestVariable,
  response: ApiResponse | null | undefined
): PostVariablePreviewResult {
  if (!response) {
    return { status: 'no-response' };
  }
  if (!variable.enabled || !variable.name.trim()) {
    return { status: 'unresolved' };
  }

  let extracted: string | undefined;
  switch (variable.source) {
    case 'body': {
      const path = variable.jsonPath?.trim();
      if (!path) {
        return { status: 'unresolved' };
      }
      try {
        const parsed = JSON.parse(response.body);
        extracted = valueToString(resolveJsonPath(parsed, path));
      } catch {
        extracted = undefined;
      }
      break;
    }
    case 'headers':
      extracted = findResponseHeader(response.headers, variable.headerName ?? '');
      break;
    case 'cookies':
      extracted = findResponseCookie(response.headers, variable.cookieName ?? '');
      break;
  }

  if (extracted === undefined) {
    return { status: 'unresolved' };
  }
  return { status: 'ok', value: extracted };
}

export function extractPostRequestVariables(
  variables: PostRequestVariable[] | undefined,
  response: ApiResponse | null | undefined
): EnvironmentVariable[] {
  if (!variables?.length || !response) {
    return [];
  }
  const result: EnvironmentVariable[] = [];
  for (const variable of variables) {
    const name = variable.name.trim();
    if (!variable.enabled || !name) {
      continue;
    }
    const extracted = extractPostRequestVariable(variable, response);
    if (extracted.status !== 'ok') {
      continue;
    }
    const existing = result.findIndex((entry) => entry.name === name);
    const entry = { name, value: extracted.value };
    if (existing >= 0) {
      result[existing] = entry;
    } else {
      result.push(entry);
    }
  }
  return result;
}

export function postRequestVariableNames(
  variables: PostRequestVariable[] | undefined
): EnvironmentVariable[] {
  if (!variables?.length) {
    return [];
  }
  const result: EnvironmentVariable[] = [];
  for (const variable of variables) {
    const name = variable.name.trim();
    if (!variable.enabled || !name) {
      continue;
    }
    const existing = result.findIndex((entry) => entry.name === name);
    if (existing >= 0) {
      result[existing] = { name, value: '' };
    } else {
      result.push({ name, value: '' });
    }
  }
  return result;
}

export function postRequestVariableTypeSummary(variable: PostRequestVariable): string {
  switch (variable.source) {
    case 'body':
      return `Response Body → ${variable.jsonPath?.trim() || '…'}`;
    case 'headers':
      return `Response Header → ${variable.headerName?.trim() || '…'}`;
    case 'cookies':
      return `Response Cookie → ${variable.cookieName?.trim() || '…'}`;
  }
}

export function createPostRequestVariable(
  source: PostRequestVariable['source'],
  name: string,
  extractor: string
): PostRequestVariable {
  const base: PostRequestVariable = {
    name: name.trim(),
    source,
    enabled: true,
  };
  switch (source) {
    case 'body':
      return { ...base, jsonPath: extractor.trim() };
    case 'headers':
      return { ...base, headerName: extractor.trim() };
    case 'cookies':
      return { ...base, cookieName: extractor.trim() };
  }
}

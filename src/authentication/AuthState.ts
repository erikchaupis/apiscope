import { AuthCookie, AuthMethodId, AuthState, AuthStatus } from '../core/types';

export function isAuthConfigured(state: AuthState | null | undefined): boolean {
  if (!state?.method) {
    return false;
  }
  switch (state.method) {
    case 'session':
      return state.cookies.length > 0;
    case 'bearer':
      return Boolean(state.bearerToken?.trim());
    case 'basic':
      return Boolean(state.basicUsername?.trim() && state.basicPassword);
    case 'api-key':
      return Boolean(state.apiKeyName?.trim() && state.apiKeyValue?.trim());
    default:
      return false;
  }
}

export function parseCookieString(cookieStr: string): AuthCookie[] {
  const cookies: AuthCookie[] = [];
  const parts = cookieStr.split(';').map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
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

export function cookiesToHeader(cookies: AuthCookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

export function mergeAuthHeaders(
  url: URL,
  headers: Record<string, string>,
  auth: AuthState | null
): { url: URL; headers: Record<string, string> } {
  if (!auth || !isAuthConfigured(auth)) {
    return { url, headers };
  }

  const next = { ...headers };

  switch (auth.method) {
    case 'session':
      if (auth.cookies.length > 0) {
        const existing = next['Cookie'] ?? next['cookie'];
        const cookieHeader = cookiesToHeader(auth.cookies);
        next['Cookie'] = existing ? `${existing}; ${cookieHeader}` : cookieHeader;
      }
      break;
    case 'bearer': {
      const token = auth.bearerToken?.trim();
      if (token && !next['Authorization']) {
        const prefix = auth.bearerPrefix?.trim() || 'Bearer';
        next['Authorization'] = token.startsWith(`${prefix} `)
          ? token
          : `${prefix} ${token}`;
      }
      break;
    }
    case 'basic': {
      const username = auth.basicUsername?.trim();
      const password = auth.basicPassword ?? '';
      if (username && !next['Authorization']) {
        const encoded = Buffer.from(`${username}:${password}`).toString('base64');
        next['Authorization'] = `Basic ${encoded}`;
      }
      break;
    }
    case 'api-key': {
      const name = auth.apiKeyName?.trim();
      const value = auth.apiKeyValue?.trim();
      if (!name || !value) {
        break;
      }
      if (auth.apiKeyIn === 'query') {
        if (!url.searchParams.has(name)) {
          url.searchParams.set(name, value);
        }
      } else if (!next[name]) {
        next[name] = value;
      }
      break;
    }
  }

  return { url, headers: next };
}

export function decodeJwtExpiration(jwt: string): Date | undefined {
  try {
    const payload = jwt.split('.')[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (typeof decoded.exp === 'number') {
      return new Date(decoded.exp * 1000);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function formatExpiration(exp: Date): string {
  const now = Date.now();
  const diffMs = exp.getTime() - now;
  if (diffMs <= 0) {
    return 'Expired';
  }
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) {
    return `Expires in ${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `Expires in ${hours}h ${remainMins}m`;
}

function normalizeMethod(state: AuthState): AuthMethodId | undefined {
  if (state.method) {
    if ((state.method as string) === 'jwt') {
      return 'bearer';
    }
    return state.method;
  }
  if (state.bearerToken) {
    return 'bearer';
  }
  if (state.loginUrl || state.cookies.length > 0) {
    return 'session';
  }
  return undefined;
}

function methodStatusLabel(
  method: AuthMethodId | undefined,
  bearerExpiration?: string,
  cookieCount?: number
): string {
  switch (method) {
    case 'session':
      return cookieCount
        ? `Session · ${cookieCount} cookie${cookieCount === 1 ? '' : 's'}`
        : 'Session';
    case 'bearer':
      return bearerExpiration ?? 'Bearer token';
    case 'basic':
      return 'Basic auth';
    case 'api-key':
      return 'API key';
    default:
      return 'Authenticated';
  }
}

export function buildAuthStatus(state: AuthState | null): AuthStatus {
  if (!state || !isAuthConfigured(state)) {
    return {
      authenticated: false,
      cookieCount: 0,
      statusLabel: 'None',
    };
  }

  const method = normalizeMethod(state);
  let bearerExpiration: string | undefined;
  if (method === 'bearer' && state.bearerToken) {
    const exp = decodeJwtExpiration(state.bearerToken);
    if (exp) {
      bearerExpiration = formatExpiration(exp);
    }
  }

  const cookieCount = state.cookies.length;
  const statusLabel = methodStatusLabel(method, bearerExpiration, cookieCount);

  return {
    authenticated: true,
    method,
    environmentId: state.environmentId,
    cookieCount,
    sessionCookieNames: method === 'session' ? state.cookies.map((c) => c.name) : undefined,
    bearerExpiration,
    statusLabel,
    jwtDetected: method === 'bearer',
    jwtExpiration: bearerExpiration,
  };
}

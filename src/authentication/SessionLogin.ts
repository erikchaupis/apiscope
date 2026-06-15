import { URL, URLSearchParams } from 'url';
import { AuthState } from '../core/types';
import { mergeCookies, parseSetCookieHeaders } from './cookies';
import { rawHttpRequest } from './httpClient';

export interface SessionLoginOptions {
  loginUrl: string;
  username: string;
  password: string;
}

export interface SessionLoginResult {
  success: boolean;
  authState?: AuthState;
  error?: string;
}

export async function performSessionLogin(
  options: SessionLoginOptions
): Promise<SessionLoginResult> {
  const loginUrl = new URL(options.loginUrl);

  const loginPage = await rawHttpRequest(loginUrl, 'GET', { Accept: 'text/html' });
  let cookies = parseSetCookieHeaders(loginPage.headers['set-cookie']);

  const csrf = extractCsrfToken(loginPage.body);
  const formBody = new URLSearchParams();
  formBody.set('username', options.username);
  formBody.set('password', options.password);
  if (csrf) {
    formBody.set(csrf.name, csrf.value);
  }

  const loginResponse = await rawHttpRequest(
    loginUrl,
    'POST',
    {
      Accept: 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(cookies.length > 0 ? { Cookie: cookiesToRequestHeader(cookies) } : {}),
    },
    formBody.toString()
  );

  cookies = mergeCookies(cookies, parseSetCookieHeaders(loginResponse.headers['set-cookie']));

  if (!isLoginSuccessful(loginResponse.statusCode, loginResponse.headers, loginResponse.body)) {
    return {
      success: false,
      error: describeLoginFailure(loginResponse.statusCode, loginResponse.body),
    };
  }

  return {
    success: true,
    authState: {
      cookies,
      localStorage: {},
      sessionStorage: {},
      capturedAt: new Date().toISOString(),
      loginUrl: options.loginUrl,
    },
  };
}

function cookiesToRequestHeader(cookies: { name: string; value: string }[]): string {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

export function extractCsrfToken(html: string): { name: string; value: string } | null {
  for (const match of html.matchAll(/<input[^>]*>/gi)) {
    const tag = match[0];
    if (!/type=["']hidden["']/i.test(tag)) {
      continue;
    }
    const name = tag.match(/name=["']([^"']+)["']/i)?.[1];
    const value = tag.match(/value=["']([^"']*)["']/i)?.[1];
    if (!name || value === undefined) {
      continue;
    }
    if (name === '_csrf' || /csrf/i.test(name)) {
      return { name, value };
    }
  }
  return null;
}

function isLoginSuccessful(
  statusCode: number,
  headers: Record<string, string | string[]>,
  body: string
): boolean {
  if (/invalid username or password/i.test(body) || /bad credentials/i.test(body)) {
    return false;
  }

  const location = getHeaderValue(headers, 'location');
  if (statusCode === 302 || statusCode === 303) {
    if (location) {
      if (/\/login/i.test(location) && /error/i.test(location)) {
        return false;
      }
      if (!/\/login/i.test(location)) {
        return true;
      }
    }
  }

  return statusCode >= 200 && statusCode < 300 && !/\/login/i.test(body);
}

function getHeaderValue(
  headers: Record<string, string | string[]>,
  name: string
): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function describeLoginFailure(statusCode: number, body: string): string {
  if (/invalid username or password/i.test(body) || /bad credentials/i.test(body)) {
    return 'Invalid username or password.';
  }
  if (statusCode === 401 || statusCode === 403) {
    return `Server rejected login (${statusCode}).`;
  }
  if (statusCode === 302 || statusCode === 303) {
    return 'Login redirected but no session cookie was returned.';
  }
  return `Unexpected response (${statusCode}).`;
}

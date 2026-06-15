import { URL, URLSearchParams } from 'url';
import { AuthCookie } from '../core/types';
import { rawHttpRequest } from './httpClient';
import { extractCsrfToken } from './SessionLogin';

function cookiesToRequestHeader(cookies: AuthCookie[]): string {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

export async function performServerLogout(
  logoutUrl: string,
  cookies: AuthCookie[],
  csrfProbeUrl?: string
): Promise<void> {
  if (cookies.length === 0) {
    return;
  }

  const cookieHeader = cookiesToRequestHeader(cookies);
  let csrf: { name: string; value: string } | null = null;

  if (csrfProbeUrl) {
    try {
      const probe = await rawHttpRequest(new URL(csrfProbeUrl), 'GET', {
        Accept: 'text/html',
        Cookie: cookieHeader,
      });
      csrf = extractCsrfToken(probe.body);
    } catch {
      // proceed without CSRF
    }
  }

  const headers: Record<string, string> = {
    Accept: 'text/html',
    Cookie: cookieHeader,
  };

  let body: string | undefined;
  if (csrf) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const formBody = new URLSearchParams();
    formBody.set(csrf.name, csrf.value);
    body = formBody.toString();
  }

  await rawHttpRequest(new URL(logoutUrl), 'POST', headers, body);
}

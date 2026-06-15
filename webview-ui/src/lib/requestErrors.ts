export type RequestErrorKind =
  | 'connection-refused'
  | 'host-not-found'
  | 'timeout'
  | 'connection-reset'
  | 'ssl-error'
  | 'missing-variable'
  | 'validation'
  | 'script'
  | 'unknown';

export interface ParsedRequestError {
  kind: RequestErrorKind;
  title: string;
  detail: string;
  target?: string;
  hint: string;
  canRetry: boolean;
}

function stripRequestFailedPrefix(error: string): string {
  return error.replace(/^Request failed:\s*/i, '').trim();
}

function hostTargetFromUrl(url?: string | null): string | undefined {
  if (!url) {
    return undefined;
  }
  try {
    const parsed = new URL(url);
    const defaultPort = parsed.protocol === 'https:' ? '443' : '80';
    if (parsed.port && parsed.port !== defaultPort) {
      return `${parsed.hostname}:${parsed.port}`;
    }
    return parsed.hostname;
  } catch {
    return url;
  }
}

function extractHostPort(raw: string): string | undefined {
  const match = raw.match(
    /(?:connect|read|write)\s+(?:ECONNREFUSED|ETIMEDOUT|ECONNRESET)\s+([^\s]+)/i
  );
  return match?.[1];
}

function extractHostname(raw: string): string | undefined {
  const match = raw.match(/ENOTFOUND\s+([^\s]+)/i) || raw.match(/EAI_AGAIN\s+([^\s]+)/i);
  return match?.[1];
}

export function parseRequestError(
  error: string,
  resolvedUrl?: string | null
): ParsedRequestError {
  const raw = stripRequestFailedPrefix(error);
  const urlTarget = hostTargetFromUrl(resolvedUrl);

  if (/^Missing variable:/i.test(raw)) {
    const names = raw.replace(/^Missing variable:\s*/i, '').trim();
    return {
      kind: 'missing-variable',
      title: 'Missing variables',
      detail: names,
      hint: 'Set the variables in your environment or request before sending.',
      canRetry: false,
    };
  }

  if (/ECONNREFUSED/i.test(raw)) {
    const target = extractHostPort(raw) ?? urlTarget;
    return {
      kind: 'connection-refused',
      title: 'Unable to connect',
      detail: 'Connection refused',
      target,
      hint: 'Check that the server is running and reachable.',
      canRetry: true,
    };
  }

  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(raw)) {
    const target = extractHostname(raw) ?? urlTarget;
    return {
      kind: 'host-not-found',
      title: 'Unable to connect',
      detail: 'Host not found',
      target,
      hint: 'Check the URL and DNS settings for this host.',
      canRetry: true,
    };
  }

  if (/ETIMEDOUT|timeout/i.test(raw)) {
    const target = extractHostPort(raw) ?? urlTarget;
    return {
      kind: 'timeout',
      title: 'Request timed out',
      detail: 'The server did not respond in time',
      target,
      hint: 'Check network connectivity or try again later.',
      canRetry: true,
    };
  }

  if (/ECONNRESET|socket hang up/i.test(raw)) {
    const target = extractHostPort(raw) ?? urlTarget;
    return {
      kind: 'connection-reset',
      title: 'Connection lost',
      detail: 'The connection was closed unexpectedly',
      target,
      hint: 'The server may have restarted or closed the connection.',
      canRetry: true,
    };
  }

  if (
    /certificate|cert|SSL|TLS|EPROTO|self signed|unable to verify/i.test(raw)
  ) {
    const target = urlTarget;
    return {
      kind: 'ssl-error',
      title: 'Secure connection failed',
      detail: raw,
      target,
      hint: 'Check the certificate, hostname, and HTTPS configuration.',
      canRetry: true,
    };
  }

  if (/script failed|assertion|post-request|pre-request/i.test(raw)) {
    return {
      kind: 'script',
      title: 'Script error',
      detail: raw,
      hint: 'Review the pre-request, post-request, or test script for errors.',
      canRetry: false,
    };
  }

  if (/multipart|upload|file not found|invalid/i.test(raw)) {
    return {
      kind: 'validation',
      title: 'Request validation failed',
      detail: raw,
      hint: 'Fix the request configuration and try again.',
      canRetry: false,
    };
  }

  return {
    kind: 'unknown',
    title: 'Request failed',
    detail: raw || 'An unexpected error occurred.',
    target: urlTarget,
    hint: 'Review the request details and try again.',
    canRetry: true,
  };
}

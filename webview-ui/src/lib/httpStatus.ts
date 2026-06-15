export type HttpStatusCategory = 'success' | 'redirect' | 'client-error' | 'server-error' | 'unknown';

export function httpStatusCategory(statusCode: number): HttpStatusCategory {
  if (statusCode >= 200 && statusCode < 300) {
    return 'success';
  }
  if (statusCode >= 300 && statusCode < 400) {
    return 'redirect';
  }
  if (statusCode >= 400 && statusCode < 500) {
    return 'client-error';
  }
  if (statusCode >= 500 && statusCode < 600) {
    return 'server-error';
  }
  return 'unknown';
}

export function statusCodeClass(statusCode: number): string {
  switch (httpStatusCategory(statusCode)) {
    case 'success':
      return 'text-success';
    case 'redirect':
      return 'text-primary';
    case 'client-error':
      return 'text-brand-orange';
    case 'server-error':
      return 'text-danger';
    default:
      return 'text-muted-foreground';
  }
}

export function statusIndicatorClass(statusCode: number): string {
  switch (httpStatusCategory(statusCode)) {
    case 'success':
      return 'bg-success';
    case 'redirect':
      return 'bg-primary';
    case 'client-error':
      return 'bg-brand-orange';
    case 'server-error':
      return 'bg-danger';
    default:
      return 'bg-foreground/30';
  }
}

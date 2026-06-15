import type { AuthMethodId } from '../types';

export interface AuthMethodMeta {
  id: AuthMethodId;
  label: string;
  description: string;
}

export const AUTH_METHODS: AuthMethodMeta[] = [
  {
    id: 'session',
    label: 'Session',
    description: 'Form login with CSRF and session cookies.',
  },
  {
    id: 'bearer',
    label: 'Bearer Token',
    description: 'Authorization header with a bearer or JWT token.',
  },
  {
    id: 'basic',
    label: 'Basic Auth',
    description: 'HTTP Basic authentication (username and password).',
  },
  {
    id: 'api-key',
    label: 'API Key',
    description: 'Custom header or query parameter for API keys.',
  },
];

export function authMethodLabel(id: AuthMethodId): string {
  return AUTH_METHODS.find((m) => m.id === id)?.label ?? id;
}

export function authHeaderPreview(
  method: AuthMethodId,
  payload: Record<string, unknown>
): string {
  switch (method) {
    case 'bearer': {
      const prefix = (payload.prefix as string) || 'Bearer';
      return `Authorization: ${prefix} ••••••`;
    }
    case 'basic':
      return `Authorization: Basic ••••••`;
    case 'api-key': {
      const name = (payload.name as string) || 'X-API-Key';
      const addTo = payload.addTo as string;
      return addTo === 'query' ? `Query: ${name}=••••••` : `${name}: ••••••`;
    }
    default:
      return 'Cookie: session cookies';
  }
}

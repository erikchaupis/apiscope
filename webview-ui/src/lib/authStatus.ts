import type { AuthStatus } from '../types';
import { authMethodLabel } from './authMethods';

export function authToolbarSummary(authStatus: AuthStatus): string {
  if (!authStatus.authenticated) {
    return authStatus.statusLabel || 'None';
  }
  if (authStatus.bearerExpiration) {
    return authStatus.bearerExpiration;
  }
  if (authStatus.statusLabel) {
    return authStatus.statusLabel;
  }
  if (authStatus.method) {
    return authMethodLabel(authStatus.method);
  }
  return 'Authenticated';
}

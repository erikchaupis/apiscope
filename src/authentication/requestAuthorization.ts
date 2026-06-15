import {
  AuthMethodId,
  AuthState,
  RequestAuthorization,
  RequestAuthorizationType,
} from '../core/types';
import { isAuthConfigured } from './AuthState';

function emptyAuthState(partial: Partial<AuthState> & { method: AuthMethodId }): AuthState {
  return {
    cookies: [],
    localStorage: {},
    sessionStorage: {},
    capturedAt: '',
    ...partial,
  };
}

export function resolveEffectiveAuthType(
  requestAuth: RequestAuthorization | undefined,
  globalAuth: AuthState | null
): RequestAuthorizationType {
  const type = requestAuth?.type ?? 'inherit';
  if (type !== 'inherit') {
    return type;
  }
  if (!globalAuth || !isAuthConfigured(globalAuth)) {
    return 'none';
  }
  return globalAuth.method ?? 'none';
}

export function resolveEffectiveAuthState(
  requestAuth: RequestAuthorization | undefined,
  globalAuth: AuthState | null
): AuthState | null {
  const type = requestAuth?.type ?? 'inherit';

  if (type === 'none') {
    return null;
  }

  if (type === 'inherit') {
    return globalAuth && isAuthConfigured(globalAuth) ? globalAuth : null;
  }

  if (type === 'session') {
    if (globalAuth?.cookies.length) {
      return { ...globalAuth, method: 'session' };
    }
    return null;
  }

  if (type === 'bearer') {
    const token = requestAuth.bearerToken?.trim();
    if (!token) {
      return null;
    }
    return emptyAuthState({
      method: 'bearer',
      bearerToken: requestAuth.bearerToken,
      bearerPrefix: requestAuth.bearerPrefix,
    });
  }

  if (type === 'basic') {
    const username = requestAuth.basicUsername?.trim();
    if (!username) {
      return null;
    }
    return emptyAuthState({
      method: 'basic',
      basicUsername: requestAuth.basicUsername,
      basicPassword: requestAuth.basicPassword ?? '',
    });
  }

  if (type === 'api-key') {
    const name = requestAuth.apiKeyName?.trim();
    const value = requestAuth.apiKeyValue?.trim();
    if (!name || !value) {
      return null;
    }
    return emptyAuthState({
      method: 'api-key',
      apiKeyName: requestAuth.apiKeyName,
      apiKeyValue: requestAuth.apiKeyValue,
      apiKeyIn: requestAuth.apiKeyIn ?? 'header',
    });
  }

  return null;
}

import { ApiKeyLocation, AuthMethodId, AuthState } from '../core/types';
import { EnvironmentManager } from '../environment/EnvironmentManager';
import { AuthStorage } from './AuthStorage';
import { executeSessionLogin, SessionLoginCredentials } from './executeSessionLogin';
import { executeSessionLogout } from './executeSessionLogout';

export interface AuthLoginResult {
  success: boolean;
  error?: string;
  cookieNames?: string[];
}

export interface BearerAuthPayload {
  token: string;
  prefix?: string;
}

export interface BasicAuthPayload {
  username: string;
  password: string;
}

export interface ApiKeyAuthPayload {
  name: string;
  value: string;
  addTo?: ApiKeyLocation;
}

function emptyAuthFields(): Pick<
  AuthState,
  'cookies' | 'localStorage' | 'sessionStorage' | 'loginUrl' | 'bearerToken' | 'bearerPrefix' | 'basicUsername' | 'basicPassword' | 'apiKeyName' | 'apiKeyValue' | 'apiKeyIn'
> {
  return {
    cookies: [],
    localStorage: {},
    sessionStorage: {},
    loginUrl: undefined,
    bearerToken: undefined,
    bearerPrefix: undefined,
    basicUsername: undefined,
    basicPassword: undefined,
    apiKeyName: undefined,
    apiKeyValue: undefined,
    apiKeyIn: undefined,
  };
}

export class AuthManager {
  async login(
    method: AuthMethodId,
    authStorage: AuthStorage,
    envManager: EnvironmentManager,
    workspaceRoot: string,
    environmentId: string,
    payload: unknown
  ): Promise<AuthLoginResult> {
    switch (method) {
      case 'session': {
        const credentials = payload as SessionLoginCredentials;
        return executeSessionLogin(authStorage, credentials, {
          method: 'session',
          environmentId,
        });
      }
      case 'bearer': {
        const { token, prefix } = payload as BearerAuthPayload;
        const trimmed = token?.trim();
        if (!trimmed) {
          return { success: false, error: 'Bearer token is required.' };
        }
        await authStorage.save({
          ...emptyAuthFields(),
          method: 'bearer',
          bearerToken: trimmed,
          bearerPrefix: prefix?.trim() || 'Bearer',
          environmentId,
          capturedAt: new Date().toISOString(),
        });
        return { success: true };
      }
      case 'basic': {
        const { username, password } = payload as BasicAuthPayload;
        const trimmedUser = username?.trim();
        if (!trimmedUser) {
          return { success: false, error: 'Username is required.' };
        }
        if (!password) {
          return { success: false, error: 'Password is required.' };
        }
        await authStorage.save({
          ...emptyAuthFields(),
          method: 'basic',
          basicUsername: trimmedUser,
          basicPassword: password,
          environmentId,
          capturedAt: new Date().toISOString(),
        });
        return { success: true };
      }
      case 'api-key': {
        const { name, value, addTo } = payload as ApiKeyAuthPayload;
        const trimmedName = name?.trim();
        const trimmedValue = value?.trim();
        if (!trimmedName) {
          return { success: false, error: 'API key name is required.' };
        }
        if (!trimmedValue) {
          return { success: false, error: 'API key value is required.' };
        }
        await authStorage.save({
          ...emptyAuthFields(),
          method: 'api-key',
          apiKeyName: trimmedName,
          apiKeyValue: trimmedValue,
          apiKeyIn: addTo === 'query' ? 'query' : 'header',
          environmentId,
          capturedAt: new Date().toISOString(),
        });
        return { success: true };
      }
      default:
        return { success: false, error: 'Unknown authentication method.' };
    }
  }

  async logout(
    method: AuthMethodId | undefined,
    authStorage: AuthStorage,
    envManager: EnvironmentManager,
    workspaceRoot: string
  ): Promise<void> {
    const stored = await authStorage.load();
    const resolved = method ?? stored?.method ?? 'session';
    if (resolved === 'session') {
      await executeSessionLogout(authStorage, envManager, workspaceRoot);
      return;
    }
    await authStorage.clear();
  }
}

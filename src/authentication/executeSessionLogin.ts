import { performSessionLogin } from './SessionLogin';
import { AuthStorage } from './AuthStorage';

export interface SessionLoginCredentials {
  loginUrl: string;
  username: string;
  password: string;
}

export interface SessionLoginExecutionResult {
  success: boolean;
  error?: string;
  cookieNames?: string[];
}

export async function executeSessionLogin(
  authStorage: AuthStorage,
  credentials: SessionLoginCredentials,
  context?: { method?: 'session'; environmentId?: string }
): Promise<SessionLoginExecutionResult> {
  const loginUrl = credentials.loginUrl.trim();
  const username = credentials.username.trim();
  const password = credentials.password;

  if (!loginUrl) {
    return { success: false, error: 'Login URL is required.' };
  }
  if (!username) {
    return { success: false, error: 'Username is required.' };
  }
  if (!password) {
    return { success: false, error: 'Password is required.' };
  }

  const result = await performSessionLogin({ loginUrl, username, password });
  if (!result.success || !result.authState) {
    return { success: false, error: result.error ?? 'Login failed.' };
  }

  await authStorage.save({
    ...result.authState,
    method: context?.method ?? 'session',
    environmentId: context?.environmentId,
  });
  return {
    success: true,
    cookieNames: result.authState.cookies.map((cookie) => cookie.name),
  };
}

import { Cookie } from 'lucide-react';
import { useState } from 'react';
import type { EnvironmentVariable } from '../../types';
import { getSessionLoginFormValues } from '../../lib/sessionLogin';
import type { AuthLoginResult } from '../../types';
import { AuthHeaderPreview, AuthResultMessage, AuthSaveButton } from './AuthFormParts';

interface SessionLoginPanelProps {
  variables: EnvironmentVariable[];
  submitting: boolean;
  result: AuthLoginResult | null;
  isActive: boolean;
  cookieNames?: string[];
  cookieCount?: number;
  onSubmit: (loginUrl: string, username: string, password: string) => void;
}

export function SessionLoginPanel({
  variables,
  submitting,
  result,
  isActive,
  cookieNames,
  cookieCount = 0,
  onSubmit,
}: SessionLoginPanelProps) {
  const defaults = getSessionLoginFormValues(variables);
  const [loginUrl, setLoginUrl] = useState(defaults.loginUrl);
  const [username, setUsername] = useState(defaults.username);
  const [password, setPassword] = useState(defaults.password);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!loginUrl.trim()) {
      setValidationError('Login URL is required.');
      return;
    }
    if (!username.trim()) {
      setValidationError('Username is required.');
      return;
    }
    if (!password) {
      setValidationError('Password is required.');
      return;
    }
    setValidationError(null);
    onSubmit(loginUrl.trim(), username.trim(), password);
  };

  return (
    <div className="max-w-xl">
      {isActive && cookieCount > 0 && (
        <div className="text-xs rounded border border-success/30 bg-success/10 text-success px-3 py-2 mb-4 flex items-start gap-2">
          <Cookie className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium mb-0.5">Session cookies available</div>
            <div>
              {cookieCount} cookie{cookieCount === 1 ? '' : 's'}
              {cookieNames && cookieNames.length > 0 ? `: ${cookieNames.join(', ')}` : ''}
            </div>
            <div className="text-success/80 mt-1">
              Sent as <span className="font-mono">Cookie</span> on each request.
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground mb-4">
        {isActive
          ? 'Sign in again to refresh session cookies, or use another method from the sidebar.'
          : 'Authenticate against a session-based app using form login. APIScope will GET the login page, extract the CSRF token, POST your credentials, and store session cookies.'}
      </p>

      <AuthHeaderPreview preview="Cookie: JSESSIONID=…" />

      <div className="space-y-3 mb-4">
        <div>
          <label htmlFor="session-login-url" className="block text-xs text-muted-foreground mb-1">
            Login URL
          </label>
          <input
            id="session-login-url"
            type="text"
            value={loginUrl}
            onChange={(e) => {
              setLoginUrl(e.target.value);
              setValidationError(null);
            }}
            disabled={submitting}
            className="w-full text-xs font-mono bg-background border border-border rounded px-2 py-1.5"
            placeholder="http://localhost:8086/login"
          />
        </div>
        <div>
          <label htmlFor="session-login-username" className="block text-xs text-muted-foreground mb-1">
            Username
          </label>
          <input
            id="session-login-username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setValidationError(null);
            }}
            disabled={submitting}
            autoComplete="username"
            className="w-full text-xs bg-background border border-border rounded px-2 py-1.5"
            placeholder="admin"
          />
        </div>
        <div>
          <label htmlFor="session-login-password" className="block text-xs text-muted-foreground mb-1">
            Password
          </label>
          <input
            id="session-login-password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setValidationError(null);
            }}
            disabled={submitting}
            autoComplete="current-password"
            className="w-full text-xs bg-background border border-border rounded px-2 py-1.5"
          />
        </div>
      </div>

      {validationError && <p className="text-xs text-danger mb-3">{validationError}</p>}
      <AuthResultMessage result={result} />

      <AuthSaveButton
        label={isActive ? 'Refresh Session' : 'Sign In'}
        submitting={submitting}
        saved={result?.success}
        onClick={handleSubmit}
      />
    </div>
  );
}

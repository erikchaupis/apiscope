import { LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AUTH_METHODS, authMethodLabel } from '../lib/authMethods';
import { cn } from '../lib/utils';
import type {
  ApiKeyLocation,
  AuthLoginPayload,
  AuthLoginResult,
  AuthMethodId,
  AuthStatus,
  Environment,
} from '../types';
import { EnvironmentTierBadge } from './EnvironmentTierBadge';
import { ApiKeyAuthPanel } from './auth/ApiKeyAuthPanel';
import { BasicAuthPanel } from './auth/BasicAuthPanel';
import { BearerAuthPanel } from './auth/BearerAuthPanel';
import { SessionLoginPanel } from './auth/SessionLoginPanel';

interface GlobalAuthenticationTabViewProps {
  environment: Environment;
  authStatus: AuthStatus;
  submitting: boolean;
  loginResult: AuthLoginResult | null;
  onAuthLogin: (method: AuthMethodId, payload: AuthLoginPayload) => void;
  onLogout: () => void;
}

export function GlobalAuthenticationTabView({
  environment,
  authStatus,
  submitting,
  loginResult,
  onAuthLogin,
  onLogout,
}: GlobalAuthenticationTabViewProps) {
  const [selectedMethod, setSelectedMethod] = useState<AuthMethodId>(
    authStatus.method ?? 'session'
  );
  const selectedMeta = AUTH_METHODS.find((m) => m.id === selectedMethod) ?? AUTH_METHODS[0];
  const isProd = environment.environmentType === 'PROD';
  const isActiveForMethod =
    authStatus.authenticated && authStatus.method === selectedMethod;
  const globalMethodLabel = authStatus.authenticated
    ? authMethodLabel(authStatus.method ?? 'session')
    : 'None';

  useEffect(() => {
    if (authStatus.method) {
      setSelectedMethod(authStatus.method);
    }
  }, [authStatus.method]);

  return (
    <div className="flex flex-1 min-h-0 min-w-0 flex-col">
      <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Active environment</span>
          <EnvironmentTierBadge tier={environment.environmentType} />
          <span className="text-sm font-medium truncate">{environment.name}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">Global Authentication</span>
          <span className="text-muted-foreground text-xs">:</span>
          <span
            className={cn(
              'text-xs font-medium',
              authStatus.authenticated ? 'text-success' : 'text-muted-foreground'
            )}
          >
            {globalMethodLabel}
          </span>
          {authStatus.authenticated && authStatus.method === 'session' && authStatus.cookieCount > 0 && (
            <span className="text-xs text-muted-foreground">
              · {authStatus.cookieCount} cookie{authStatus.cookieCount === 1 ? '' : 's'}
            </span>
          )}
          {authStatus.authenticated && authStatus.statusLabel && authStatus.method !== 'session' && (
            <span className="text-xs text-muted-foreground">· {authStatus.statusLabel}</span>
          )}
          {authStatus.authenticated && (
            <button
              type="button"
              onClick={onLogout}
              className="btn-logout ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded border shrink-0 font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          )}
        </div>
      </div>

      {isProd && (
        <div className="mx-4 mt-3 text-xs rounded border border-[var(--environment-prod-fg)]/30 bg-[var(--environment-prod-bg)] text-[var(--environment-prod-fg)] px-3 py-2 shrink-0">
          You are authenticating against a <strong>Production</strong> environment. Verify the
          target before signing in.
        </div>
      )}

      <div className="flex flex-1 min-h-0 min-w-0">
        <div className="w-52 shrink-0 border-r border-border flex flex-col min-h-0 overflow-hidden bg-card">
          <div className="px-3 py-2 border-b border-border shrink-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Methods
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto py-1">
            {AUTH_METHODS.map((method) => {
              const isSelected = selectedMethod === method.id;
              const isActive =
                authStatus.authenticated && authStatus.method === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setSelectedMethod(method.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs hover:bg-[var(--as-tree-hover)]',
                    isSelected && 'bg-[var(--as-tree-selected)]'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{method.label}</span>
                    {isActive && (
                      <span className="text-[10px] text-success uppercase ml-auto">Active</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                    {method.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col flex-1 min-h-0 min-w-0 p-4 overflow-y-auto">
          <h2 className="text-sm font-semibold mb-1">{selectedMeta.label}</h2>
          {isActiveForMethod && (
            <p className="text-xs text-success mb-3">
              Active for this environment via {authMethodLabel(selectedMethod)}
            </p>
          )}

          {selectedMethod === 'session' && (
            <SessionLoginPanel
              variables={environment.variables}
              submitting={submitting}
              result={loginResult}
              isActive={isActiveForMethod}
              cookieNames={authStatus.sessionCookieNames}
              cookieCount={authStatus.cookieCount}
              onSubmit={(loginUrl, username, password) =>
                onAuthLogin('session', { loginUrl, username, password })
              }
            />
          )}
          {selectedMethod === 'bearer' && (
            <BearerAuthPanel
              submitting={submitting}
              result={loginResult}
              isActive={isActiveForMethod}
              onSubmit={(token, prefix) => onAuthLogin('bearer', { token, prefix })}
            />
          )}
          {selectedMethod === 'basic' && (
            <BasicAuthPanel
              submitting={submitting}
              result={loginResult}
              isActive={isActiveForMethod}
              onSubmit={(username, password) => onAuthLogin('basic', { username, password })}
            />
          )}
          {selectedMethod === 'api-key' && (
            <ApiKeyAuthPanel
              submitting={submitting}
              result={loginResult}
              isActive={isActiveForMethod}
              onSubmit={(name, value, addTo) =>
                onAuthLogin('api-key', { name, value, addTo: addTo as ApiKeyLocation })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

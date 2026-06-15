import { Shield, ShieldOff } from 'lucide-react';
import type { AuthStatus } from '../types';

interface AuthDashboardProps {
  authStatus: AuthStatus;
  onClearAuth: () => void;
}

export function AuthDashboard({ authStatus, onClearAuth }: AuthDashboardProps) {
  return (
    <div className="px-3 py-2 border-b border-border bg-card text-sm shrink-0">
      <div className="flex items-center gap-2">
        {authStatus.authenticated ? (
          <Shield className="w-4 h-4 text-success" />
        ) : (
          <ShieldOff className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="font-medium">
          {authStatus.authenticated ? 'Authenticated' : 'Not authenticated'}
        </span>
        {authStatus.authenticated && (
          <button
            type="button"
            onClick={onClearAuth}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground underline"
          >
            Clear
          </button>
        )}
      </div>
      {authStatus.authenticated && (
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {authStatus.method === 'session' && (
            <span>Cookies: {authStatus.cookieCount}</span>
          )}
          {authStatus.method && <span>Method: {authStatus.statusLabel}</span>}
        </div>
      )}
    </div>
  );
}

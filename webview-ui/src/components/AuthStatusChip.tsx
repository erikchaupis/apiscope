import { KeyRound, Shield } from 'lucide-react';
import type { AuthStatus } from '../types';
import { authToolbarSummary } from '../lib/authStatus';
import { cn } from '../lib/utils';

interface AuthStatusChipProps {
  authStatus: AuthStatus;
  onClick: () => void;
}

export function AuthStatusChip({ authStatus, onClick }: AuthStatusChipProps) {
  const summary = authToolbarSummary(authStatus);
  const authenticated = authStatus.authenticated;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 text-xs px-2 py-1 rounded shrink-0 max-w-[200px] font-medium',
        authenticated ? 'toolbar-auth-chip-authenticated' : 'toolbar-btn-login'
      )}
      title={authenticated ? 'Open Global Authentication' : 'Configure Global Authentication'}
    >
      {authenticated ? (
        <Shield className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <KeyRound className="w-3.5 h-3.5 shrink-0" />
      )}
      <span className="truncate">{summary}</span>
    </button>
  );
}

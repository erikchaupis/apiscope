import { CheckCircle2, Loader2 } from 'lucide-react';
import type { AuthLoginResult } from '../../types';

interface AuthSaveButtonProps {
  label: string;
  submitting: boolean;
  saved?: boolean;
  onClick: () => void;
}

export function AuthSaveButton({ label, submitting, saved, onClick }: AuthSaveButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={submitting}
      className="px-3 py-1.5 text-sm rounded bg-primary text-background font-medium disabled:opacity-60 flex items-center gap-1.5"
    >
      {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {!submitting && saved && <CheckCircle2 className="w-3.5 h-3.5" />}
      {submitting ? 'Saving…' : saved ? 'Saved' : label}
    </button>
  );
}

interface AuthResultMessageProps {
  result: AuthLoginResult | null;
}

export function AuthResultMessage({ result }: AuthResultMessageProps) {
  if (!result) {
    return null;
  }
  if (result.success) {
    return (
      <div className="text-xs rounded border border-border bg-secondary/40 text-success px-3 py-2 mb-3">
        <div className="font-medium mb-1">Authentication saved</div>
        {result.cookieNames && result.cookieNames.length > 0 ? (
          <div>Cookies captured: {result.cookieNames.join(', ')}</div>
        ) : (
          <div>Requests will include the configured auth headers.</div>
        )}
      </div>
    );
  }
  return (
    <div className="text-xs rounded border border-border bg-secondary/40 text-danger px-3 py-2 mb-3">
      <div className="font-medium mb-1">Could not save authentication</div>
      <div>{result.error ?? 'Unknown error.'}</div>
    </div>
  );
}

interface AuthHeaderPreviewProps {
  preview: string;
}

export function AuthHeaderPreview({ preview }: AuthHeaderPreviewProps) {
  return (
    <div className="text-xs rounded border border-dashed border-border bg-background/50 px-3 py-2 mb-4 font-mono text-muted-foreground">
      <span className="text-foreground font-sans font-medium not-italic mr-2">Adds</span>
      {preview}
    </div>
  );
}

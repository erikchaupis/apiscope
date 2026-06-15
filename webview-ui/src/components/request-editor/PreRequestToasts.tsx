import { useEffect } from 'react';

interface PreRequestUndoToastProps {
  variableName: string;
  onUndo: () => void;
  onDismiss: () => void;
}

export function PreRequestUndoToast({
  variableName,
  onUndo,
  onDismiss,
}: PreRequestUndoToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timer);
  }, [onDismiss, variableName]);

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-border bg-card shadow-lg px-3 py-2.5 text-sm">
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">
          Variable deleted{variableName ? `: ${variableName}` : ''}
        </span>
        <button
          type="button"
          onClick={onUndo}
          className="text-primary font-medium hover:underline shrink-0"
        >
          Undo
        </button>
      </div>
    </div>
  );
}

interface CopiedVariableToastProps {
  token: string;
  onDismiss: () => void;
}

export function CopiedVariableToast({ token, onDismiss }: CopiedVariableToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 2500);
    return () => window.clearTimeout(timer);
  }, [onDismiss, token]);

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-border bg-card shadow-lg px-3 py-2.5 text-sm">
      <span className="text-muted-foreground">
        Copied: <span className="font-mono text-foreground">{token}</span>
      </span>
    </div>
  );
}

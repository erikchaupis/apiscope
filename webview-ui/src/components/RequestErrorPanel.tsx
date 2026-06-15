import { AlertTriangle } from 'lucide-react';
import { parseRequestError } from '../lib/requestErrors';
import { cn } from '../lib/utils';

interface RequestErrorPanelProps {
  error: string;
  resolvedUrl?: string | null;
  onRetry?: () => void;
  canRetry?: boolean;
}

function titleClass(kind: ReturnType<typeof parseRequestError>['kind']): string {
  switch (kind) {
    case 'missing-variable':
    case 'validation':
    case 'script':
      return 'text-warning';
    default:
      return 'text-danger';
  }
}

export function RequestErrorPanel({
  error,
  resolvedUrl,
  onRetry,
  canRetry = true,
}: RequestErrorPanelProps) {
  const parsed = parseRequestError(error, resolvedUrl);
  const showRetry = parsed.canRetry && canRetry && onRetry;

  return (
    <div className="flex-1 min-h-0 p-4 flex flex-col justify-center overflow-auto">
      <div className="rounded-lg border border-border bg-card max-w-md p-4 space-y-3 shadow-sm">
        <div className={cn('flex items-center gap-2 text-sm font-semibold', titleClass(parsed.kind))}>
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
          {parsed.title}
        </div>

        <div>
          <div className="text-sm font-medium text-foreground">{parsed.detail}</div>
          {parsed.target && (
            <div className="text-xs font-mono text-muted-foreground mt-1">{parsed.target}</div>
          )}
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">{parsed.hint}</p>

        {showRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent font-medium"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

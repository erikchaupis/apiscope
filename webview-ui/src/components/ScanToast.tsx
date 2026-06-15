import { useEffect } from 'react';
import { Check } from 'lucide-react';
import type { ScanSummary } from '../types';

interface ScanToastProps {
  summary: ScanSummary;
  onDismiss: () => void;
}

export function ScanToast({ summary, onDismiss }: ScanToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  const hasChanges =
    summary.added.length > 0 || summary.updated.length > 0 || summary.removed.length > 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-border bg-card shadow-lg p-3 text-sm">
      <div className="flex items-start gap-2">
        <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="font-medium">Scan completed</div>
          {summary.endpointCount !== undefined && !hasChanges && (
            <div className="text-muted-foreground text-xs mt-0.5">
              {summary.endpointCount} endpoint{summary.endpointCount === 1 ? '' : 's'} discovered
            </div>
          )}
          {hasChanges && (
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5 font-mono">
              {summary.added.length > 0 && (
                <div className="text-success">+{summary.added.length} Added</div>
              )}
              {summary.updated.length > 0 && (
                <div className="text-warning">~{summary.updated.length} Updated</div>
              )}
              {summary.removed.length > 0 && (
                <div className="text-danger">-{summary.removed.length} Removed</div>
              )}
            </div>
          )}
          {summary.endpointCount !== undefined && hasChanges && (
            <div className="text-xs text-muted-foreground mt-1">
              {summary.endpointCount} endpoint{summary.endpointCount === 1 ? '' : 's'} total
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

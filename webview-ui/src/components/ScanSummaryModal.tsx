import type { ScanSummary } from '../types';

interface ScanSummaryModalProps {
  summary: ScanSummary;
  onClose: () => void;
}

export function ScanSummaryModal({ summary, onClose }: ScanSummaryModalProps) {
  const hasChanges =
    summary.added.length > 0 || summary.updated.length > 0 || summary.removed.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full mx-4 p-4">
        <h3 className="font-semibold text-sm mb-3">Scan Results</h3>
        {!hasChanges ? (
          <p className="text-sm text-muted-foreground mb-4">No changes detected.</p>
        ) : (
          <div className="space-y-3 text-sm font-mono mb-4 max-h-64 overflow-y-auto">
            {summary.added.length > 0 && (
              <div>
                <div className="text-xs font-sans font-medium text-muted-foreground mb-1">Added</div>
                {summary.added.map((line) => (
                  <div key={line} className="text-success">
                    {line}
                  </div>
                ))}
              </div>
            )}
            {summary.updated.length > 0 && (
              <div>
                <div className="text-xs font-sans font-medium text-muted-foreground mb-1">Updated</div>
                {summary.updated.map((line) => (
                  <div key={line} className="text-warning">
                    {line}
                  </div>
                ))}
              </div>
            )}
            {summary.removed.length > 0 && (
              <div>
                <div className="text-xs font-sans font-medium text-muted-foreground mb-1">Removed</div>
                {summary.removed.map((line) => (
                  <div key={line} className="text-danger">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded bg-primary text-background font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

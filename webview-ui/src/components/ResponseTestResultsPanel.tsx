import type { ResponseTestResult } from '../types';
import { cn } from '../lib/utils';

interface ResponseTestResultsPanelProps {
  results: ResponseTestResult[];
}

export function ResponseTestResultsPanel({ results }: ResponseTestResultsPanelProps) {
  if (results.length === 0) {
    return (
      <div className="flex-1 min-h-0 p-4 text-sm text-muted-foreground">
        No validation checks configured. Add checks in the Tests tab to verify responses.
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
      {results.map((result) => (
        <ResponseTestResultCard key={result.checkId} result={result} />
      ))}
    </div>
  );
}

function ResponseTestResultCard({ result }: { result: ResponseTestResult }) {
  return (
    <div
      className={cn(
        'border border-border rounded-md px-3 py-2.5 bg-card',
        result.passed ? 'border-success/30' : 'border-danger/30'
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'text-sm shrink-0 mt-0.5',
            result.passed ? 'text-success' : 'text-danger'
          )}
          aria-hidden
        >
          {result.passed ? '✓' : '✗'}
        </span>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-medium font-mono">{result.name}</p>
          {result.passed ? (
            <>
              {result.expected !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Expected:{' '}
                  <span className="font-mono text-foreground">{result.expected}</span>
                </p>
              )}
              {result.actual !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Actual: <span className="font-mono text-foreground">{result.actual}</span>
                </p>
              )}
            </>
          ) : result.conditionFailed ? (
            <p className="text-xs text-muted-foreground">Condition returned false</p>
          ) : (
            <>
              {result.expected !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Expected:{' '}
                  <span className="font-mono text-foreground">{result.expected}</span>
                </p>
              )}
              {result.actual !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Actual: <span className="font-mono text-foreground">{result.actual}</span>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function summarizeTestResults(results: ResponseTestResult[]): {
  passed: number;
  failed: number;
  total: number;
} {
  const enabledResults = results.filter((result) => result.checkId !== 'disabled');
  const passed = enabledResults.filter((result) => result.passed).length;
  const failed = enabledResults.filter((result) => !result.passed).length;
  return { passed, failed, total: enabledResults.length };
}

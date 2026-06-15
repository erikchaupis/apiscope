import { useEffect, useMemo, useState } from 'react';
import type { Environment, EnvironmentVariable } from '../types';
import { displayVariableValue, environmentListLabel, sortEnvironmentsForList } from '../lib/environmentUtils';

interface CopyVariableModalProps {
  sourceEnvironment: Environment;
  variable: EnvironmentVariable;
  environments: Environment[];
  showSensitiveValues: boolean;
  onCopy: (targetEnvironmentIds: string[], overwriteExisting: boolean) => void;
  onCancel: () => void;
}

export function CopyVariableModal({
  sourceEnvironment,
  variable,
  environments,
  showSensitiveValues,
  onCopy,
  onCancel,
}: CopyVariableModalProps) {
  const targetEnvironments = useMemo(
    () => sortEnvironmentsForList(environments.filter((env) => env.id !== sourceEnvironment.id)),
    [environments, sourceEnvironment.id]
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(targetEnvironments.map((env) => env.id))
  );
  const [overwriteExisting, setOverwriteExisting] = useState(true);

  useEffect(() => {
    setSelectedIds(new Set(targetEnvironments.map((env) => env.id)));
  }, [targetEnvironments]);

  const toggleTarget = (environmentId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(environmentId)) {
        next.delete(environmentId);
      } else {
        next.add(environmentId);
      }
      return next;
    });
  };

  const displayValue = displayVariableValue(variable, showSensitiveValues, true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl"
        role="dialog"
        aria-labelledby="copy-variable-title"
      >
        <div className="px-4 py-3 border-b border-border">
          <h3 id="copy-variable-title" className="font-semibold text-sm">
            Copy Variable
          </h3>
        </div>

        <div className="px-4 py-3 space-y-4 text-sm">
          <div>
            <span className="block text-xs text-muted-foreground mb-1">Variable</span>
            <div className="text-xs font-mono bg-muted/30 border border-border rounded px-2 py-1.5">
              {variable.name.trim() || '(unnamed)'}
            </div>
          </div>

          <div>
            <span className="block text-xs text-muted-foreground mb-1">Value</span>
            <div className="text-xs font-mono bg-muted/30 border border-border rounded px-2 py-1.5 break-all">
              {displayValue || '(empty)'}
            </div>
          </div>

          <div>
            <span className="block text-xs text-muted-foreground mb-2">Target Environments</span>
            {targetEnvironments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No other environments available.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded border border-border divide-y divide-border">
                {targetEnvironments.map((env) => (
                  <label
                    key={env.id}
                    className="flex items-center gap-2 px-2.5 py-2 text-xs hover:bg-accent/40 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(env.id)}
                      onChange={() => toggleTarget(env.id)}
                      className="rounded border-border"
                    />
                    <span className="truncate">{environmentListLabel(env)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={overwriteExisting}
              onChange={(e) => setOverwriteExisting(e.target.checked)}
              className="rounded border-border"
            />
            Overwrite existing values
          </label>
        </div>

        <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedIds.size === 0 || !variable.name.trim()}
            onClick={() => onCopy([...selectedIds], overwriteExisting)}
            className="text-xs px-3 py-1.5 rounded bg-primary text-background font-medium disabled:opacity-50"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}

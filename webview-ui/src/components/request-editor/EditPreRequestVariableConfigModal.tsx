import { useState } from 'react';
import {
  TIMESTAMP_FORMAT_LABELS,
  preRequestVariableTypeSummary,
} from '../../lib/preRequestVariables';
import type { PreRequestVariable, TimestampFormat } from '../../types';
import { cn } from '../../lib/utils';

interface EditPreRequestVariableConfigModalProps {
  variable: PreRequestVariable;
  onSave: (patch: Partial<PreRequestVariable>) => void;
  onCancel: () => void;
}

const TIMESTAMP_FORMATS: TimestampFormat[] = [
  'unix-seconds',
  'unix-milliseconds',
  'iso-8601',
];

export function EditPreRequestVariableConfigModal({
  variable,
  onSave,
  onCancel,
}: EditPreRequestVariableConfigModalProps) {
  const [timestampFormat, setTimestampFormat] = useState(
    variable.timestampFormat ?? 'unix-seconds'
  );
  const [min, setMin] = useState(variable.min ?? 0);
  const [max, setMax] = useState(variable.max ?? 100_000);
  const [length, setLength] = useState(variable.length ?? 8);
  const [domain, setDomain] = useState(variable.domain ?? 'test.com');
  const [staticValue, setStaticValue] = useState(variable.staticValue ?? '');

  const handleSave = () => {
    switch (variable.type) {
      case 'timestamp':
        onSave({ timestampFormat });
        break;
      case 'random-number':
        onSave({ min, max });
        break;
      case 'random-string':
        onSave({ length });
        break;
      case 'random-email':
        onSave({ domain: domain.trim() || 'test.com' });
        break;
      case 'static':
        onSave({ staticValue });
        break;
      default:
        onCancel();
    }
  };

  if (variable.type === 'uuid') {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-4">
        <h3 className="font-semibold text-sm mb-1">Configure Variable</h3>
        <p className="text-xs text-muted-foreground mb-4">
          {variable.name} · {preRequestVariableTypeSummary(variable).split(' (')[0]}
        </p>

        {variable.type === 'timestamp' && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground mb-2">Format</p>
            {TIMESTAMP_FORMATS.map((format) => (
              <label
                key={format}
                className={cn(
                  'flex items-center gap-2 rounded border px-3 py-2 cursor-pointer text-sm',
                  timestampFormat === format
                    ? 'border-primary/50 bg-[var(--as-tree-selected)]'
                    : 'border-border hover:bg-accent/40'
                )}
              >
                <input
                  type="radio"
                  name="edit-timestamp-format"
                  checked={timestampFormat === format}
                  onChange={() => setTimestampFormat(format)}
                />
                <span>{TIMESTAMP_FORMAT_LABELS[format]}</span>
              </label>
            ))}
          </div>
        )}

        {variable.type === 'random-number' && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground block mb-1">Min</label>
              <input
                type="number"
                value={min}
                onChange={(e) => setMin(Number(e.target.value))}
                className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm font-mono"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground block mb-1">Max</label>
              <input
                type="number"
                value={max}
                onChange={(e) => setMax(Number(e.target.value))}
                className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm font-mono"
              />
            </div>
          </div>
        )}

        {variable.type === 'random-string' && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Length</label>
            <input
              type="number"
              min={1}
              max={256}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm font-mono"
            />
          </div>
        )}

        {variable.type === 'random-email' && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Domain</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="test.com"
              className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm font-mono"
            />
          </div>
        )}

        {variable.type === 'static' && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Fixed Value</label>
            <input
              type="text"
              value={staticValue}
              onChange={(e) => setStaticValue(e.target.value)}
              placeholder="v1"
              autoFocus
              className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm font-mono"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded border border-border hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1.5 text-sm rounded bg-primary text-background font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

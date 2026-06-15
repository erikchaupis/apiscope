import { useState } from 'react';
import {
  PRE_REQUEST_VARIABLE_TYPE_LABELS,
  TIMESTAMP_FORMAT_LABELS,
  WIZARD_VARIABLE_TYPES,
  createPreRequestVariable,
} from '../../lib/preRequestVariables';
import type { PreRequestVariable, PreRequestVariableType, TimestampFormat } from '../../types';
import { cn } from '../../lib/utils';

interface AddPreRequestVariableModalProps {
  existingNames: string[];
  onCreate: (variable: PreRequestVariable) => void;
  onCancel: () => void;
}

type WizardStep = 'type' | 'name' | 'config';

const TIMESTAMP_FORMATS: TimestampFormat[] = [
  'unix-seconds',
  'unix-milliseconds',
  'iso-8601',
];

export function AddPreRequestVariableModal({
  existingNames,
  onCreate,
  onCancel,
}: AddPreRequestVariableModalProps) {
  const [step, setStep] = useState<WizardStep>('type');
  const [type, setType] = useState<PreRequestVariableType>('uuid');
  const [name, setName] = useState('');
  const [timestampFormat, setTimestampFormat] = useState<TimestampFormat>('unix-seconds');
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(100_000);
  const [length, setLength] = useState(8);
  const [domain, setDomain] = useState('test.com');
  const [staticValue, setStaticValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const needsConfigStep = type !== 'uuid';

  const validateName = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Variable name is required.';
    }
    if (!/^\w+$/.test(trimmed)) {
      return 'Use letters, numbers, and underscores only.';
    }
    if (existingNames.includes(trimmed)) {
      return 'A variable with this name already exists.';
    }
    return null;
  };

  const goNextFromType = () => {
    setError(null);
    setStep('name');
  };

  const goNextFromName = () => {
    const nameError = validateName(name);
    if (nameError) {
      setError(nameError);
      return;
    }
    setError(null);
    if (needsConfigStep) {
      setStep('config');
      return;
    }
    handleCreate();
  };

  const handleCreate = () => {
    const nameError = validateName(name);
    if (nameError) {
      setError(nameError);
      setStep('name');
      return;
    }

    const variable = createPreRequestVariable(type, name);
    switch (type) {
      case 'timestamp':
        variable.timestampFormat = timestampFormat;
        break;
      case 'random-number':
        variable.min = min;
        variable.max = max;
        break;
      case 'random-string':
        variable.length = length;
        break;
      case 'random-email':
        variable.domain = domain.trim() || 'test.com';
        break;
      case 'static':
        variable.staticValue = staticValue;
        break;
    }
    onCreate(variable);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-4">
        <h3 className="font-semibold text-sm mb-1">Add Variable</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Step {step === 'type' ? 1 : step === 'name' ? 2 : 3} of {needsConfigStep ? 3 : 2}
        </p>

        {step === 'type' && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground mb-2">Choose Variable Type</p>
            {WIZARD_VARIABLE_TYPES.map((option) => (
              <label
                key={option}
                className={cn(
                  'flex items-center gap-2 rounded border px-3 py-2 cursor-pointer text-sm',
                  type === option
                    ? 'border-primary/50 bg-[var(--as-tree-selected)]'
                    : 'border-border hover:bg-accent/40'
                )}
              >
                <input
                  type="radio"
                  name="pre-request-type"
                  checked={type === option}
                  onChange={() => setType(option)}
                  className="shrink-0"
                />
                <span>{PRE_REQUEST_VARIABLE_TYPE_LABELS[option]}</span>
              </label>
            ))}
          </div>
        )}

        {step === 'name' && (
          <div>
            <label htmlFor="pre-request-var-name" className="text-xs text-muted-foreground block mb-1">
              Variable Name
            </label>
            <input
              id="pre-request-var-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="requestId"
              autoFocus
              className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm font-mono"
              onKeyDown={(e) => e.key === 'Enter' && goNextFromName()}
            />
          </div>
        )}

        {step === 'config' && (
          <div className="space-y-3">
            {type === 'timestamp' && (
              <div>
                <p className="text-xs font-medium text-foreground mb-2">Format</p>
                <div className="space-y-2">
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
                        name="timestamp-format"
                        checked={timestampFormat === format}
                        onChange={() => setTimestampFormat(format)}
                      />
                      <span>{TIMESTAMP_FORMAT_LABELS[format]}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {type === 'random-number' && (
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
            {type === 'random-string' && (
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
            {type === 'random-email' && (
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
            {type === 'static' && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Fixed Value</label>
                <input
                  type="text"
                  value={staticValue}
                  onChange={(e) => setStaticValue(e.target.value)}
                  placeholder="v1"
                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm font-mono"
                />
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-danger mt-3">{error}</p>}

        <div className="flex justify-between gap-2 mt-5">
          <button
            type="button"
            onClick={() => {
              if (step === 'type') {
                onCancel();
              } else if (step === 'name') {
                setStep('type');
                setError(null);
              } else {
                setStep('name');
                setError(null);
              }
            }}
            className="px-3 py-1.5 text-sm rounded border border-border hover:bg-accent"
          >
            {step === 'type' ? 'Cancel' : 'Back'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (step === 'type') {
                goNextFromType();
              } else if (step === 'name') {
                goNextFromName();
              } else {
                handleCreate();
              }
            }}
            className="px-3 py-1.5 text-sm rounded bg-primary text-background font-medium"
          >
            {step === 'config' || (step === 'name' && !needsConfigStep) ? 'Create' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

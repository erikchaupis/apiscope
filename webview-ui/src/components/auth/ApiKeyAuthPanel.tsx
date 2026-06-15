import { useState } from 'react';
import type { ApiKeyLocation, AuthLoginResult } from '../../types';
import { authHeaderPreview } from '../../lib/authMethods';
import { cn } from '../../lib/utils';
import { AuthHeaderPreview, AuthResultMessage, AuthSaveButton } from './AuthFormParts';

interface ApiKeyAuthPanelProps {
  submitting: boolean;
  result: AuthLoginResult | null;
  isActive: boolean;
  onSubmit: (name: string, value: string, addTo: ApiKeyLocation) => void;
}

const COMMON_KEY_NAMES = ['X-API-Key', 'api-key', 'x-api-key', 'Authorization'];

export function ApiKeyAuthPanel({
  submitting,
  result,
  isActive,
  onSubmit,
}: ApiKeyAuthPanelProps) {
  const [name, setName] = useState('X-API-Key');
  const [value, setValue] = useState('');
  const [addTo, setAddTo] = useState<ApiKeyLocation>('header');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!name.trim()) {
      setValidationError('Key name is required.');
      return;
    }
    if (!value.trim()) {
      setValidationError('API key value is required.');
      return;
    }
    setValidationError(null);
    onSubmit(name.trim(), value.trim(), addTo);
  };

  return (
    <div className="max-w-xl">
      <p className="text-xs text-muted-foreground mb-4">
        Add a static API key as a request header or query parameter. Common for gateways and public
        APIs.
      </p>

      <AuthHeaderPreview preview={authHeaderPreview('api-key', { name, addTo })} />

      <div className="space-y-3 mb-4">
        <div>
          <label htmlFor="api-key-name" className="block text-xs text-muted-foreground mb-1">
            Key name
          </label>
          <input
            id="api-key-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setValidationError(null);
            }}
            disabled={submitting}
            list="api-key-name-suggestions"
            className="w-full text-xs font-mono bg-background border border-border rounded px-2 py-1.5"
            placeholder="X-API-Key"
          />
          <datalist id="api-key-name-suggestions">
            {COMMON_KEY_NAMES.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="api-key-value" className="block text-xs text-muted-foreground mb-1">
            Key value
          </label>
          <input
            id="api-key-value"
            type="password"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setValidationError(null);
            }}
            disabled={submitting}
            className="w-full text-xs font-mono bg-background border border-border rounded px-2 py-1.5"
            placeholder="your-api-key"
          />
        </div>
        <div>
          <span className="block text-xs text-muted-foreground mb-1.5">Add to</span>
          <div className="flex gap-2">
            {(['header', 'query'] as const).map((option) => (
              <button
                key={option}
                type="button"
                disabled={submitting}
                onClick={() => setAddTo(option)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded border capitalize',
                  addTo === option
                    ? 'bg-[var(--as-tree-selected)] border-primary/40 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent'
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {validationError && <p className="text-xs text-danger mb-3">{validationError}</p>}
      <AuthResultMessage result={result} />

      <AuthSaveButton
        label={isActive ? 'Update API Key' : 'Save API Key'}
        submitting={submitting}
        saved={result?.success}
        onClick={handleSubmit}
      />
    </div>
  );
}

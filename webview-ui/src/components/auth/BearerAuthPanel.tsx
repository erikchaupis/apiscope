import { useState } from 'react';
import type { AuthLoginResult } from '../../types';
import { authHeaderPreview } from '../../lib/authMethods';
import { AuthHeaderPreview, AuthResultMessage, AuthSaveButton } from './AuthFormParts';

interface BearerAuthPanelProps {
  submitting: boolean;
  result: AuthLoginResult | null;
  isActive: boolean;
  onSubmit: (token: string, prefix: string) => void;
}

export function BearerAuthPanel({
  submitting,
  result,
  isActive,
  onSubmit,
}: BearerAuthPanelProps) {
  const [token, setToken] = useState('');
  const [prefix, setPrefix] = useState('Bearer');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!token.trim()) {
      setValidationError('Bearer token is required.');
      return;
    }
    setValidationError(null);
    onSubmit(token.trim(), prefix.trim() || 'Bearer');
  };

  return (
    <div className="max-w-xl">
      <p className="text-xs text-muted-foreground mb-4">
        Paste an access token or JWT. APIScope adds an{' '}
        <span className="font-mono">Authorization</span> header on every request unless you override
        it on the request itself.
      </p>

      <AuthHeaderPreview preview={authHeaderPreview('bearer', { prefix, token: 'x' })} />

      <div className="space-y-3 mb-4">
        <div>
          <label htmlFor="bearer-prefix" className="block text-xs text-muted-foreground mb-1">
            Prefix
          </label>
          <input
            id="bearer-prefix"
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            disabled={submitting}
            className="w-full max-w-[200px] text-xs font-mono bg-background border border-border rounded px-2 py-1.5"
            placeholder="Bearer"
          />
        </div>
        <div>
          <label htmlFor="bearer-token" className="block text-xs text-muted-foreground mb-1">
            Token
          </label>
          <textarea
            id="bearer-token"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setValidationError(null);
            }}
            disabled={submitting}
            rows={4}
            className="w-full text-xs font-mono bg-background border border-border rounded px-2 py-1.5 resize-y min-h-[80px]"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5c6IkpXVCJ9…"
          />
        </div>
      </div>

      {validationError && <p className="text-xs text-danger mb-3">{validationError}</p>}
      <AuthResultMessage result={result} />

      <AuthSaveButton
        label={isActive ? 'Update Token' : 'Save Token'}
        submitting={submitting}
        saved={result?.success}
        onClick={handleSubmit}
      />
    </div>
  );
}

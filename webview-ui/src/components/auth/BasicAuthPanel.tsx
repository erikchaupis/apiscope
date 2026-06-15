import { useState } from 'react';
import type { AuthLoginResult } from '../../types';
import { authHeaderPreview } from '../../lib/authMethods';
import { AuthHeaderPreview, AuthResultMessage, AuthSaveButton } from './AuthFormParts';

interface BasicAuthPanelProps {
  submitting: boolean;
  result: AuthLoginResult | null;
  isActive: boolean;
  onSubmit: (username: string, password: string) => void;
}

export function BasicAuthPanel({
  submitting,
  result,
  isActive,
  onSubmit,
}: BasicAuthPanelProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!username.trim()) {
      setValidationError('Username is required.');
      return;
    }
    if (!password) {
      setValidationError('Password is required.');
      return;
    }
    setValidationError(null);
    onSubmit(username.trim(), password);
  };

  return (
    <div className="max-w-xl">
      <p className="text-xs text-muted-foreground mb-4">
        HTTP Basic authentication encodes username and password into an{' '}
        <span className="font-mono">Authorization</span> header. Credentials are stored securely in
        VS Code secret storage.
      </p>

      <AuthHeaderPreview preview={authHeaderPreview('basic', {})} />

      <div className="space-y-3 mb-4">
        <div>
          <label htmlFor="basic-username" className="block text-xs text-muted-foreground mb-1">
            Username
          </label>
          <input
            id="basic-username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setValidationError(null);
            }}
            disabled={submitting}
            autoComplete="username"
            className="w-full text-xs bg-background border border-border rounded px-2 py-1.5"
          />
        </div>
        <div>
          <label htmlFor="basic-password" className="block text-xs text-muted-foreground mb-1">
            Password
          </label>
          <input
            id="basic-password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setValidationError(null);
            }}
            disabled={submitting}
            autoComplete="current-password"
            className="w-full text-xs bg-background border border-border rounded px-2 py-1.5"
          />
        </div>
      </div>

      {validationError && <p className="text-xs text-danger mb-3">{validationError}</p>}
      <AuthResultMessage result={result} />

      <AuthSaveButton
        label={isActive ? 'Update Credentials' : 'Save Credentials'}
        submitting={submitting}
        saved={result?.success}
        onClick={handleSubmit}
      />
    </div>
  );
}

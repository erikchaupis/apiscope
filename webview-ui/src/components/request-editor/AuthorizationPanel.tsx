import { cn } from '../../lib/utils';
import { VariableAutocompleteInput } from '../VariableAutocompleteInput';
import {
  REQUEST_AUTHORIZATION_LABELS,
  defaultRequestAuthorization,
  effectiveAuthenticationLabel,
} from '../../lib/requestEditor';
import type { AuthStatus, RequestAuthorization, RequestAuthorizationType } from '../../types';

interface AuthorizationPanelProps {
  authorization: RequestAuthorization;
  globalAuth: AuthStatus;
  readOnly?: boolean;
  variableSuggestions?: string[];
  onChange: (authorization: RequestAuthorization) => void;
}

const AUTHORIZATION_TYPES: RequestAuthorizationType[] = [
  'inherit',
  'none',
  'session',
  'bearer',
  'basic',
  'api-key',
];

export function AuthorizationPanel({
  authorization,
  globalAuth,
  readOnly = false,
  variableSuggestions = [],
  onChange,
}: AuthorizationPanelProps) {
  const type = authorization.type ?? defaultRequestAuthorization().type;
  const effectiveLabel = effectiveAuthenticationLabel(authorization, globalAuth);

  const update = (patch: Partial<RequestAuthorization>) => {
    onChange({ ...authorization, ...patch });
  };

  return (
    <div className="space-y-4 pt-2">
      <div>
        <label htmlFor="request-auth-type" className="block text-xs text-muted-foreground mb-1">
          Type
        </label>
        <select
          id="request-auth-type"
          value={type}
          disabled={readOnly}
          onChange={(e) => update({ type: e.target.value as RequestAuthorizationType })}
          className="w-full max-w-xs text-xs bg-background border border-border rounded px-2 py-1.5"
        >
          {AUTHORIZATION_TYPES.map((option) => (
            <option key={option} value={option}>
              {REQUEST_AUTHORIZATION_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded border border-border bg-muted/20 px-3 py-2">
        <span className="block text-xs text-muted-foreground mb-1">Effective Authentication</span>
        <span
          className={cn(
            'text-sm font-medium',
            effectiveLabel === 'None' ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          {effectiveLabel}
        </span>
        {type === 'inherit' && (
          <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
            Inherits from Global Authentication for the active environment. Override this request
            type to use different credentials.
          </p>
        )}
      </div>

      {type === 'none' && (
        <p className="text-xs text-muted-foreground">
          This request will not send authentication when override support is enabled.
        </p>
      )}

      {type === 'session' && (
        <p className="text-xs text-muted-foreground">
          Request-level session settings will apply when override support is enabled.
        </p>
      )}

      {type === 'bearer' && (
        <div className="space-y-3">
          <div>
            <label htmlFor="req-auth-bearer-prefix" className="block text-xs text-muted-foreground mb-1">
              Prefix
            </label>
            <VariableAutocompleteInput
              id="req-auth-bearer-prefix"
              value={authorization.bearerPrefix ?? 'Bearer'}
              readOnly={readOnly}
              suggestions={variableSuggestions}
              onChange={(bearerPrefix) => update({ bearerPrefix })}
              className="w-full max-w-[200px] text-xs font-mono bg-background border border-border rounded px-2 py-1.5"
            />
          </div>
          <div>
            <label htmlFor="req-auth-bearer-token" className="block text-xs text-muted-foreground mb-1">
              Token
            </label>
            <VariableAutocompleteInput
              id="req-auth-bearer-token"
              value={authorization.bearerToken ?? ''}
              readOnly={readOnly}
              suggestions={variableSuggestions}
              onChange={(bearerToken) => update({ bearerToken })}
              multiline
              rows={3}
              placeholder="Paste bearer token…"
              className="w-full text-xs font-mono bg-background border border-border rounded px-2 py-1.5 resize-y min-h-[72px]"
            />
          </div>
        </div>
      )}

      {type === 'basic' && (
        <div className="space-y-3">
          <div>
            <label htmlFor="req-auth-basic-user" className="block text-xs text-muted-foreground mb-1">
              Username
            </label>
            <VariableAutocompleteInput
              id="req-auth-basic-user"
              value={authorization.basicUsername ?? ''}
              readOnly={readOnly}
              suggestions={variableSuggestions}
              onChange={(basicUsername) => update({ basicUsername })}
              className="w-full text-xs bg-background border border-border rounded px-2 py-1.5"
            />
          </div>
          <div>
            <label htmlFor="req-auth-basic-pass" className="block text-xs text-muted-foreground mb-1">
              Password
            </label>
            <VariableAutocompleteInput
              id="req-auth-basic-pass"
              value={authorization.basicPassword ?? ''}
              readOnly={readOnly}
              suggestions={variableSuggestions}
              onChange={(basicPassword) => update({ basicPassword })}
              className="w-full text-xs bg-background border border-border rounded px-2 py-1.5"
            />
          </div>
        </div>
      )}

      {type === 'api-key' && (
        <div className="space-y-3">
          <div>
            <label htmlFor="req-auth-api-key-name" className="block text-xs text-muted-foreground mb-1">
              Key name
            </label>
            <VariableAutocompleteInput
              id="req-auth-api-key-name"
              value={authorization.apiKeyName ?? 'X-API-Key'}
              readOnly={readOnly}
              suggestions={variableSuggestions}
              onChange={(apiKeyName) => update({ apiKeyName })}
              className="w-full text-xs font-mono bg-background border border-border rounded px-2 py-1.5"
            />
          </div>
          <div>
            <label htmlFor="req-auth-api-key-value" className="block text-xs text-muted-foreground mb-1">
              Key value
            </label>
            <VariableAutocompleteInput
              id="req-auth-api-key-value"
              value={authorization.apiKeyValue ?? ''}
              readOnly={readOnly}
              suggestions={variableSuggestions}
              onChange={(apiKeyValue) => update({ apiKeyValue })}
              className="w-full text-xs font-mono bg-background border border-border rounded px-2 py-1.5"
            />
          </div>
          <div>
            <span className="block text-xs text-muted-foreground mb-1.5">Add to</span>
            <div className="flex gap-2">
              {(['header', 'query'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={readOnly}
                  onClick={() => update({ apiKeyIn: option })}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded border capitalize',
                    (authorization.apiKeyIn ?? 'header') === option
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
      )}
    </div>
  );
}

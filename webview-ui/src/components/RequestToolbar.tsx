import { ArrowDownUp, Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ApiRequest, EnvironmentVariable, HttpMethod } from '../types';
import { syncQueryParamsFromUrl } from '../lib/urlQuerySync';
import { formatSendShortcut } from '../lib/keyboardShortcuts';
import { KbdShortcut } from './KbdShortcut';
import {
  VariableAutocompleteInput,
  type VariableAutocompleteInputHandle,
} from './VariableAutocompleteInput';
import {
  cn,
  buildPreviewVariableScope,
  buildRequestVariableScope,
  findMissingVariablesInRequest,
  findPathVariableFocus,
  hasTemplateVariables,
  methodClass,
  resolveTemplate,
  variableSuggestionNames,
} from '../lib/utils';
import { RequestEditorTabBar, type RequestEditorPanel } from './RequestEditorTabBar';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

interface RequestToolbarProps {
  request: ApiRequest;
  onChange: (request: ApiRequest) => void;
  onSend: () => void;
  sending: boolean;
  environmentVariables: EnvironmentVariable[];
  response?: import('../types').ApiResponse | null;
  runtimeVariables?: EnvironmentVariable[];
  focusRequestId: string | null;
  onToggleLayout: () => void;
  readOnly?: boolean;
  badgeLabel?: string;
  captureResponse?: boolean;
  onCaptureResponseChange?: (enabled: boolean) => void;
  extraActions?: React.ReactNode;
  editorTab?: RequestEditorPanel;
  onEditorTabChange?: (panel: RequestEditorPanel) => void;
}

export function RequestToolbar({
  request,
  onChange,
  onSend,
  sending,
  environmentVariables,
  response = null,
  runtimeVariables = [],
  focusRequestId,
  onToggleLayout,
  readOnly = false,
  badgeLabel,
  captureResponse = false,
  onCaptureResponseChange,
  extraActions,
  editorTab,
  onEditorTabChange,
}: RequestToolbarProps) {
  const urlInputRef = useRef<VariableAutocompleteInputHandle>(null);
  const lastFocusedRequestId = useRef<string | null>(null);
  const [urlHovered, setUrlHovered] = useState(false);

  useEffect(() => {
    if (readOnly || !focusRequestId || focusRequestId === lastFocusedRequestId.current) {
      return;
    }
    lastFocusedRequestId.current = focusRequestId;

    const input = urlInputRef.current;
    if (!input) {
      return;
    }

    const focus = findPathVariableFocus(request.url);
    if (focus) {
      onChange({
        ...request,
        url: focus.url,
        queryParams: syncQueryParamsFromUrl(focus.url, request.queryParams),
      });
      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(focus.selectionStart, focus.selectionEnd);
      });
      return;
    }

    requestAnimationFrame(() => input.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when a new endpoint is selected
  }, [focusRequestId, readOnly]);

  const requestVariableScope = useMemo(
    () => buildRequestVariableScope(request, environmentVariables, runtimeVariables),
    [request, environmentVariables, runtimeVariables]
  );
  const previewVariableScope = useMemo(
    () => buildPreviewVariableScope(request, environmentVariables, response, runtimeVariables),
    [request, environmentVariables, response, runtimeVariables]
  );
  const variableSuggestions = useMemo(
    () => variableSuggestionNames(requestVariableScope),
    [requestVariableScope]
  );

  const missingVariables = useMemo(
    () => findMissingVariablesInRequest(request, requestVariableScope),
    [request, requestVariableScope]
  );
  const showResolvedPreview = hasTemplateVariables(request.url);
  const resolvedUrl = resolveTemplate(request.url, previewVariableScope);
  const canSend = missingVariables.length === 0 && !readOnly;
  const sendShortcut = formatSendShortcut();

  const handleUrlSubmit = () => {
    if (canSend && !sending) {
      onSend();
    }
  };

  return (
    <div className="shrink-0 w-full border-b border-border bg-card">
      <div className="flex items-center gap-2 p-2">
        <select
          value={request.method}
          disabled={readOnly}
          onChange={(e) => onChange({ ...request, method: e.target.value as HttpMethod })}
          className={cn(
            'text-sm font-semibold bg-card border border-border rounded px-2 py-1 shrink-0',
            methodClass(request.method),
            readOnly && 'opacity-80'
          )}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <div
          className="relative flex-1 min-w-0"
          onMouseEnter={() => setUrlHovered(true)}
          onMouseLeave={() => setUrlHovered(false)}
        >
          <VariableAutocompleteInput
            ref={urlInputRef}
            value={request.url}
            readOnly={readOnly}
            suggestions={variableSuggestions}
            onSubmit={handleUrlSubmit}
            onChange={(url) => {
              onChange({
                ...request,
                url,
                queryParams: syncQueryParamsFromUrl(url, request.queryParams),
              });
            }}
            className={cn(
              'w-full text-sm bg-background border border-border rounded px-2 py-1 font-mono',
              readOnly && 'opacity-90'
            )}
            placeholder="{{baseUrl}}/path"
          />
          {showResolvedPreview && urlHovered && (
            <div
              role="tooltip"
              className="absolute left-0 right-0 top-full z-50 mt-1 rounded border border-border bg-card px-2 py-1.5 text-xs font-mono shadow-md pointer-events-none"
            >
              <span className="text-muted-foreground">Resolved:</span>{' '}
              <span className="text-foreground break-all">{resolvedUrl}</span>
            </div>
          )}
        </div>
        {badgeLabel && (
          <span className="text-xs text-muted-foreground shrink-0">{badgeLabel}</span>
        )}
        {extraActions}
        <button
          type="button"
          onClick={onSend}
          disabled={sending || !canSend}
          className="flex items-center gap-1.5 px-3 py-1 btn-send rounded text-sm font-medium disabled:opacity-50 shrink-0"
          title={
            !canSend && missingVariables.length > 0
              ? `Missing variable: ${missingVariables.join(', ')}`
              : readOnly
                ? 'Read-only view'
                : `Send request (${sendShortcut})`
          }
        >
          <Play className="w-3.5 h-3.5" />
          <span>Send</span>
          {canSend && !readOnly && <KbdShortcut className="border-0 bg-black/10 text-inherit">{sendShortcut}</KbdShortcut>}
        </button>
        {!readOnly && onCaptureResponseChange && (
          <button
            type="button"
            aria-pressed={captureResponse}
            onClick={() => onCaptureResponseChange(!captureResponse)}
            className={cn(
              'btn-rec shrink-0 flex items-center justify-center w-8 h-8 rounded border',
              captureResponse ? 'btn-rec-on' : 'btn-rec-off'
            )}
            title={
              captureResponse
                ? 'Response capture on — response body saved to history. Click to disable.'
                : 'Response capture off — click to store response body in history.'
            }
          >
            <span className="btn-rec-dot" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={onToggleLayout}
          className="p-1.5 rounded border border-border hover:bg-accent text-muted-foreground hover:text-foreground shrink-0"
          title="Toggle Layout"
        >
          <ArrowDownUp className="w-3.5 h-3.5" />
        </button>
      </div>
      {editorTab !== undefined && onEditorTabChange && (
        <RequestEditorTabBar value={editorTab} onChange={onEditorTabChange} />
      )}
      {missingVariables.length > 0 && !readOnly && (
        <div className="px-2 pb-2 text-xs text-warning">
          Missing variable: {missingVariables.join(', ')}
        </div>
      )}
    </div>
  );
}

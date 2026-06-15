import { useState } from 'react';
import { cn, methodClass } from '../lib/utils';
import type { HistoryEntry, AuthStatus } from '../types';
import { RequestResponseLayout } from './RequestResponseLayout';
import { RequestDetails } from './RequestDetails';
import { RequestEditorTabBar, type RequestEditorPanel } from './RequestEditorTabBar';
import { ResponseViewer } from './ResponseViewer';
import type { AppTheme } from '../types';

interface HistoryExecutionPanelProps {
  entry: HistoryEntry;
  authStatus: AuthStatus;
  theme: AppTheme;
  layout: 'horizontal' | 'vertical';
  onCreateDraft: () => void;
}

export function HistoryExecutionPanel({
  entry,
  authStatus,
  theme,
  layout,
  onCreateDraft,
}: HistoryExecutionPanelProps) {
  const [editorTab, setEditorTab] = useState<RequestEditorPanel>('request');
  const response = entry.response ?? null;
  const error = entry.error ?? null;

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0">
      <div className="shrink-0 border-b border-border bg-card px-3 py-2 flex items-center gap-2 flex-wrap">
        <span
          className={cn(
            'text-sm font-semibold',
            methodClass(entry.request.method)
          )}
        >
          {entry.request.method}
        </span>
        <span className="text-sm font-mono truncate">{entry.signature.replace(/^[A-Z]+ /, '')}</span>
        <span className="text-xs text-muted-foreground">[History]</span>
        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
          Read only
        </span>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {new Date(entry.timestamp).toLocaleString()}
        </span>
        <button
          type="button"
          onClick={onCreateDraft}
          className="text-xs px-2 py-1 rounded border border-border hover:bg-accent"
        >
          Create Draft
        </button>
      </div>
      <div className="shrink-0 px-3 py-1 text-xs font-mono text-muted-foreground border-b border-border truncate">
        {entry.resolvedUrl}
      </div>
      <RequestEditorTabBar value={editorTab} onChange={setEditorTab} />
      <RequestResponseLayout
        layout={layout}
        panels={[
          {
            id: 'history-request',
            content: (
              <RequestDetails
                request={entry.request}
                onChange={() => undefined}
                theme={theme}
                authStatus={authStatus}
                panel={editorTab}
                readOnly
              />
            ),
          },
          {
            id: 'history-response',
            content: (
              <ResponseViewer
                response={response}
                error={error}
                resolvedUrl={entry.resolvedUrl}
                method={entry.request.method}
                canSend={false}
                showSendHint={false}
                theme={theme}
                captureResponse={entry.captureResponse}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

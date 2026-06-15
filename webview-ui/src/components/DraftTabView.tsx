import { useMemo, useState } from 'react';
import type { ApiRequest, AppTheme, AuthStatus, EnvironmentVariable, RequestResponseLayoutMode } from '../types';
import { RequestDetails } from './RequestDetails';
import type { RequestEditorPanel } from './RequestEditorTabBar';
import { RequestResponseLayout } from './RequestResponseLayout';
import { RequestToolbar } from './RequestToolbar';
import { ResponseViewer } from './ResponseViewer';
import { buildRequestVariableScope, findMissingVariablesInRequest } from '../lib/utils';

interface DraftTabViewProps {
  request: ApiRequest;
  response: import('../types').ApiResponse | null;
  error: string | null;
  sending: boolean;
  draftName?: string;
  environmentVariables: EnvironmentVariable[];
  runtimeVariables?: EnvironmentVariable[];
  authStatus: AuthStatus;
  theme: AppTheme;
  layout: RequestResponseLayoutMode;
  resolvedRequestUrl: string;
  focusRequestId: string | null;
  onChange: (request: ApiRequest) => void;
  onSend: () => void;
  onToggleLayout: () => void;
  onSaveToCollection: () => void;
  onPickUploadFile?: (fieldIndex: number) => void;
  uploadFileStatuses?: import('./MultipartFormEditor').UploadFilePathStatus[];
  variableSuggestions?: string[];
}

export function DraftTabView({
  request,
  response,
  error,
  sending,
  environmentVariables,
  runtimeVariables = [],
  authStatus,
  theme,
  layout,
  resolvedRequestUrl,
  focusRequestId,
  onChange,
  onSend,
  onToggleLayout,
  onSaveToCollection,
  onPickUploadFile,
  uploadFileStatuses = [],
  variableSuggestions = [],
}: DraftTabViewProps) {
  const [editorTab, setEditorTab] = useState<RequestEditorPanel>('request');
  const requestVariableScope = useMemo(
    () => buildRequestVariableScope(request, environmentVariables, runtimeVariables),
    [request, environmentVariables, runtimeVariables]
  );
  const canSend = useMemo(
    () => findMissingVariablesInRequest(request, requestVariableScope).length === 0,
    [request, requestVariableScope]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0">
      <RequestToolbar
        request={request}
        onChange={onChange}
        onSend={onSend}
        sending={sending}
        environmentVariables={environmentVariables}
        runtimeVariables={runtimeVariables}
        response={response}
        focusRequestId={focusRequestId}
        onToggleLayout={onToggleLayout}
        editorTab={editorTab}
        onEditorTabChange={setEditorTab}
        extraActions={
          <button
            type="button"
            onClick={onSaveToCollection}
            className="text-xs px-2 py-1 rounded border border-border hover:bg-accent shrink-0"
          >
            Save to Collection
          </button>
        }
      />
      <RequestResponseLayout
        layout={layout}
        panels={[
          {
            id: 'draft-request',
            content: (
              <RequestDetails
                request={request}
                onChange={onChange}
                theme={theme}
                authStatus={authStatus}
                panel={editorTab}
                onPickUploadFile={onPickUploadFile}
                uploadFileStatuses={uploadFileStatuses}
                variableSuggestions={variableSuggestions}
                response={response}
              />
            ),
          },
          {
            id: 'draft-response',
            content: (
              <ResponseViewer
                response={response}
                error={error}
                resolvedUrl={resolvedRequestUrl}
                method={request.method}
                sending={sending}
                canSend={canSend}
                theme={theme}
                onRetry={onSend}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { syncUrlFromQueryParams } from '../lib/urlQuerySync';
import {
  getRequestAuthorization,
  getRequestAutomation,
  isSectionExpanded,
  toggleExpandedSection,
} from '../lib/requestEditor';
import type { ApiRequest, AppTheme, AuthStatus, KeyValuePair } from '../types';
import { CollapsibleSection } from './CollapsibleSection';
import { VariableAutocompleteInput } from './VariableAutocompleteInput';
import { RequestBodyEditor } from './RequestBodyEditor';
import type { UploadFilePathStatus } from './MultipartFormEditor';
import {
  VariablesSubTabBar,
  ScriptsSubTabBar,
  type RequestEditorPanel,
  type VariablesSubTab,
  type ScriptsSubTab,
} from './RequestEditorTabBar';
import { AuthorizationPanel } from './request-editor/AuthorizationPanel';
import { PreRequestVariablesEditor } from './request-editor/PreRequestVariablesEditor';
import { PostVariablesEditor } from './request-editor/PostVariablesEditor';
import { ScriptsPanel } from './request-editor/ScriptsPanel';
import { TestsPanel } from './request-editor/TestsPanel';

interface RequestDetailsProps {
  request: ApiRequest;
  onChange: (request: ApiRequest) => void;
  theme: AppTheme;
  authStatus: AuthStatus;
  panel?: RequestEditorPanel;
  readOnly?: boolean;
  variableSuggestions?: string[];
  response?: import('../types').ApiResponse | null;
  scriptConsoleLogs?: string[];
  onPickUploadFile?: (fieldIndex: number) => void;
  uploadFileStatuses?: UploadFilePathStatus[];
}

export function RequestDetails({
  request,
  onChange,
  theme,
  authStatus,
  panel = 'request',
  readOnly = false,
  variableSuggestions = [],
  response = null,
  scriptConsoleLogs = [],
  onPickUploadFile,
  uploadFileStatuses = [],
}: RequestDetailsProps) {
  const [variablesSubTab, setVariablesSubTab] = useState<VariablesSubTab>('pre');
  const [scriptsSubTab, setScriptsSubTab] = useState<ScriptsSubTab>('pre');
  const authorization = getRequestAuthorization(request);
  const automation = getRequestAutomation(request);

  const toggleSection = (sectionId: string) => {
    if (readOnly) {
      return;
    }
    onChange({
      ...request,
      ui: toggleExpandedSection(request.ui, sectionId),
    });
  };

  const updateHeader = (index: number, field: keyof KeyValuePair, value: string | boolean) => {
    const headers = [...request.headers];
    headers[index] = { ...headers[index], [field]: value };
    onChange({ ...request, headers });
  };

  const addHeader = () => {
    onChange({
      ...request,
      headers: [...request.headers, { key: '', value: '', enabled: true }],
    });
  };

  const removeHeader = (index: number) => {
    onChange({ ...request, headers: request.headers.filter((_, i) => i !== index) });
  };

  const applyQueryParams = (queryParams: KeyValuePair[]) => {
    onChange({
      ...request,
      queryParams,
      url: syncUrlFromQueryParams(request.url, queryParams),
    });
  };

  const updateQuery = (index: number, field: keyof KeyValuePair, value: string | boolean) => {
    const queryParams = [...request.queryParams];
    queryParams[index] = { ...queryParams[index], [field]: value };
    applyQueryParams(queryParams);
  };

  const addQuery = () => {
    applyQueryParams([...request.queryParams, { key: '', value: '', enabled: true }]);
  };

  const removeQuery = (index: number) => {
    applyQueryParams(request.queryParams.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
      {panel === 'request' && (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 space-y-2 text-sm">
          <CollapsibleSection
            id="params"
            title="Params"
            expanded={isSectionExpanded(request.ui, 'params')}
            onToggle={toggleSection}
          >
            <div className="pt-2">
              <div className="flex items-center justify-end mb-2">
                {!readOnly && (
                  <button
                    type="button"
                    onClick={addQuery}
                    className="text-xs flex items-center gap-0.5 hover:text-foreground text-muted-foreground"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                )}
              </div>
              {request.queryParams.length === 0 ? (
                <p className="text-xs text-muted-foreground">No query parameters.</p>
              ) : (
                request.queryParams.map((q, i) => (
                  <div key={i} className="flex gap-1 mb-1">
                    <input
                      type="checkbox"
                      checked={q.enabled}
                      disabled={readOnly}
                      onChange={(e) => updateQuery(i, 'enabled', e.target.checked)}
                    />
                    <input
                      value={q.key}
                      readOnly={readOnly}
                      onChange={(e) => updateQuery(i, 'key', e.target.value)}
                      placeholder="Key"
                      className="flex-1 min-w-0 bg-background border border-border rounded px-1.5 py-0.5 text-xs font-mono"
                    />
                    <VariableAutocompleteInput
                      value={q.value}
                      readOnly={readOnly}
                      suggestions={variableSuggestions}
                      onChange={(value) => updateQuery(i, 'value', value)}
                      placeholder="Value"
                      className="flex-[2] min-w-0 bg-background border border-border rounded px-1.5 py-0.5 text-xs font-mono"
                    />
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeQuery(i)}
                        className="p-0.5 text-muted-foreground hover:text-danger shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="headers"
            title="Headers"
            expanded={isSectionExpanded(request.ui, 'headers')}
            onToggle={toggleSection}
          >
            <div className="pt-2">
              <div className="flex items-center justify-end mb-2">
                {!readOnly && (
                  <button
                    type="button"
                    onClick={addHeader}
                    className="text-xs flex items-center gap-0.5 hover:text-foreground text-muted-foreground"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                )}
              </div>
              {request.headers.length === 0 ? (
                <p className="text-xs text-muted-foreground">No headers.</p>
              ) : (
                request.headers.map((h, i) => (
                  <div key={i} className="flex gap-1 mb-1">
                    <input
                      type="checkbox"
                      checked={h.enabled}
                      disabled={readOnly}
                      onChange={(e) => updateHeader(i, 'enabled', e.target.checked)}
                    />
                    <VariableAutocompleteInput
                      value={h.key}
                      readOnly={readOnly}
                      suggestions={variableSuggestions}
                      onChange={(value) => updateHeader(i, 'key', value)}
                      placeholder="Header Name"
                      className="flex-1 min-w-0 bg-background border border-border rounded px-1.5 py-0.5 text-xs font-mono"
                    />
                    <VariableAutocompleteInput
                      value={h.value}
                      readOnly={readOnly}
                      suggestions={variableSuggestions}
                      onChange={(value) => updateHeader(i, 'value', value)}
                      placeholder="Header Value"
                      className="flex-[2] min-w-0 bg-background border border-border rounded px-1.5 py-0.5 text-xs font-mono"
                    />
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeHeader(i)}
                        className="p-0.5 text-muted-foreground hover:text-danger shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="body"
            title="Body"
            expanded={isSectionExpanded(request.ui, 'body')}
            onToggle={toggleSection}
          >
            <RequestBodyEditor
              request={request}
              onChange={onChange}
              theme={theme}
              readOnly={readOnly}
              variableSuggestions={variableSuggestions}
              onPickUploadFile={onPickUploadFile ?? (() => undefined)}
              uploadFileStatuses={uploadFileStatuses}
            />
          </CollapsibleSection>
        </div>
      )}

      {panel === 'authentication' && (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 text-sm">
          <AuthorizationPanel
            authorization={authorization}
            globalAuth={authStatus}
            readOnly={readOnly}
            variableSuggestions={variableSuggestions}
            onChange={(next) => onChange({ ...request, authorization: next })}
          />
        </div>
      )}

      {panel === 'variables' && (
        <>
          <VariablesSubTabBar value={variablesSubTab} onChange={setVariablesSubTab} />
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 text-sm">
            {variablesSubTab === 'pre' && (
              <PreRequestVariablesEditor
                variables={automation.preRequestVariables ?? []}
                readOnly={readOnly}
                onChange={(preRequestVariables) =>
                  onChange({
                    ...request,
                    automation: { ...automation, preRequestVariables },
                  })
                }
              />
            )}
            {variablesSubTab === 'post' && (
              <PostVariablesEditor
                variables={automation.postRequestVariables ?? []}
                response={response}
                readOnly={readOnly}
                onChange={(postRequestVariables) =>
                  onChange({
                    ...request,
                    automation: { ...automation, postRequestVariables },
                  })
                }
              />
            )}
          </div>
        </>
      )}

      {panel === 'scripts' && (
        <>
          <ScriptsSubTabBar value={scriptsSubTab} onChange={setScriptsSubTab} />
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 text-sm">
            <ScriptsPanel
              subTab={scriptsSubTab}
              preScript={automation.preRequest ?? ''}
              postScript={automation.postRequest ?? ''}
              readOnly={readOnly}
              scriptConsoleLogs={scriptConsoleLogs}
              onPreScriptChange={(preRequest) =>
                onChange({
                  ...request,
                  automation: { ...automation, preRequest },
                })
              }
              onPostScriptChange={(postRequest) =>
                onChange({
                  ...request,
                  automation: { ...automation, postRequest },
                })
              }
            />
          </div>
        </>
      )}

      {panel === 'tests' && (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 text-sm">
          <TestsPanel
            checks={automation.responseTests ?? []}
            response={response}
            scriptTests={automation.tests}
            readOnly={readOnly}
            onChange={(responseTests) =>
              onChange({
                ...request,
                automation: { ...automation, responseTests },
              })
            }
            onScriptTestsChange={(tests) =>
              onChange({
                ...request,
                automation: { ...automation, tests },
              })
            }
          />
        </div>
      )}
    </div>
  );
}

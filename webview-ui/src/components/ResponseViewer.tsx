import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { JsonCodeBlock } from './JsonCodeBlock';
import { FileResponseViewer } from './FileResponseViewer';
import { KbdShortcut } from './KbdShortcut';
import { ResponseTestResultsPanel, summarizeTestResults } from './ResponseTestResultsPanel';
import { RequestErrorPanel } from './RequestErrorPanel';
import { ResponseHeadersView } from './ResponseHeadersView';
import { ResponseSummaryBar } from './ResponseSummaryBar';
import { ResponseViewFormatToggle, type ResponseViewFormat } from './ResponseViewFormatToggle';
import type { ApiResponse, AppTheme, HttpMethod, ResponseTestCheck, ResponseTestResult } from '../types';
import { formatSendShortcut } from '../lib/keyboardShortcuts';
import { payloadByteLength } from '../lib/payloadSize';
import { isJsonResponse } from '../lib/responseContent';
import { mergeTestExecutionResults } from '../lib/responseTests';
import { cn, methodClass } from '../lib/utils';

interface ResponseViewerProps {
  response: ApiResponse | null;
  error: string | null;
  resolvedUrl?: string | null;
  method?: HttpMethod;
  sending?: boolean;
  canSend?: boolean;
  /** When false, hides Send / shortcut hints in the empty state (e.g. history). */
  showSendHint?: boolean;
  theme: AppTheme;
  checks?: ResponseTestCheck[];
  storedTestResults?: ResponseTestResult[];
  captureResponse?: boolean;
  onRetry?: () => void;
}

type ResponseSection = 'body' | 'headers' | 'tests';

function sectionTabClass(active: boolean): string {
  return cn(
    'text-xs px-2 py-0.5 rounded font-medium',
    active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
  );
}

export function ResponseViewer({
  response,
  error,
  resolvedUrl,
  method,
  sending = false,
  canSend = true,
  showSendHint = true,
  theme,
  checks = [],
  storedTestResults = [],
  captureResponse,
  onRetry,
}: ResponseViewerProps) {
  const [section, setSection] = useState<ResponseSection>('body');
  const [bodyFormat, setBodyFormat] = useState<ResponseViewFormat>('pretty');
  const [headersFormat, setHeadersFormat] = useState<ResponseViewFormat>('pretty');

  const testResults = useMemo(
    () => mergeTestExecutionResults(checks, response, storedTestResults),
    [checks, response, storedTestResults]
  );

  const testSummary = useMemo(() => summarizeTestResults(testResults), [testResults]);
  const hasTestsConfigured =
    (checks?.some((check) => check.enabled) ?? false) ||
    storedTestResults.some((result) => result.checkId === 'script-test');

  const isJsonBody = useMemo(
    () => (response ? isJsonResponse(response.headers, response.body) : false),
    [response]
  );

  const responseSizeBytes = useMemo(
    () => (response ? payloadByteLength(response.body) : 0),
    [response]
  );

  useEffect(() => {
    if (!response) {
      return;
    }
    setBodyFormat(isJsonResponse(response.headers, response.body) ? 'pretty' : 'raw');
  }, [response]);

  const sendShortcut = formatSendShortcut();

  if (error) {
    return (
      <RequestErrorPanel
        error={error}
        resolvedUrl={resolvedUrl}
        onRetry={onRetry}
        canRetry={canSend}
      />
    );
  }

  if (!response) {
    return (
      <div className="flex-1 min-h-0 p-4 text-sm text-muted-foreground flex flex-col justify-center">
        {sending ? (
          <>
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
              Sending request…
            </div>
            {resolvedUrl && (
              <div className="mt-2 flex items-baseline gap-2 min-w-0">
                {method && (
                  <span className={cn('text-xs font-semibold shrink-0', methodClass(method))}>
                    {method}
                  </span>
                )}
                <span className="text-xs font-mono truncate">{resolvedUrl}</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="font-medium text-foreground">No response yet</div>
            <p className="mt-1 leading-relaxed">
              Send the request to view status, headers, and body.
            </p>
            {showSendHint && (
              canSend ? (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <span>Click Send or press</span>
                  <KbdShortcut>{sendShortcut}</KbdShortcut>
                </p>
              ) : (
                <p className="mt-2 text-xs text-warning">Resolve missing variables before sending.</p>
              )
            )}
            {resolvedUrl && (
              <div className="mt-3 flex items-baseline gap-2 min-w-0 pt-3 border-t border-border/60">
                {method && (
                  <span className={cn('text-xs font-semibold shrink-0', methodClass(method))}>
                    {method}
                  </span>
                )}
                <span className="text-xs font-mono truncate">{resolvedUrl}</span>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (response.fileResponse) {
    return (
      <FileResponseViewer
        fileResponse={response.fileResponse}
        statusCode={response.statusCode}
        statusText={response.statusText}
        durationMs={response.durationMs}
      />
    );
  }

  const showFormatToggle = section === 'body' || section === 'headers';

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-3 py-2 border-b border-border shrink-0 text-sm space-y-1.5">
        <ResponseSummaryBar
          statusCode={response.statusCode}
          statusText={response.statusText}
          durationMs={response.durationMs}
          responseSizeBytes={responseSizeBytes}
        />

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSection('body')}
              className={sectionTabClass(section === 'body')}
            >
              Body
            </button>
            <button
              type="button"
              onClick={() => setSection('headers')}
              className={sectionTabClass(section === 'headers')}
            >
              Headers
            </button>
            {hasTestsConfigured && (
              <button
                type="button"
                onClick={() => setSection('tests')}
                className={sectionTabClass(section === 'tests')}
              >
                Tests
              </button>
            )}
          </div>

          <div className="flex-1" />

          {showFormatToggle && section === 'body' && (
            <ResponseViewFormatToggle
              value={bodyFormat}
              onChange={setBodyFormat}
              disablePretty={!isJsonBody}
            />
          )}
          {showFormatToggle && section === 'headers' && (
            <ResponseViewFormatToggle value={headersFormat} onChange={setHeadersFormat} />
          )}
        </div>

        {hasTestsConfigured && testSummary.total > 0 && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-success">✓ {testSummary.passed} Passed</span>
            {testSummary.failed > 0 && (
              <span className="text-danger">✗ {testSummary.failed} Failed</span>
            )}
          </div>
        )}
        {captureResponse === false && !response.fileResponse && !response.body && (
          <p className="text-xs text-muted-foreground">
            Response body was not captured. Enable REC before sending to store downloads in history.
          </p>
        )}
      </div>

      {section === 'tests' ? (
        <ResponseTestResultsPanel results={testResults} />
      ) : section === 'headers' ? (
        <ResponseHeadersView headers={response.headers} format={headersFormat} />
      ) : bodyFormat === 'pretty' && isJsonBody ? (
        <JsonCodeBlock raw={response.body} theme={theme} />
      ) : (
        <pre className="flex-1 overflow-auto p-3 text-xs font-mono m-0 bg-background whitespace-pre-wrap break-words">
          {response.body || '(empty body)'}
        </pre>
      )}
    </div>
  );
}

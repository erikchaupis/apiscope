import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import type { ScriptsSubTab } from '../RequestEditorTabBar';
import { AutomationScriptEditor } from './AutomationScriptEditor';
import { ScriptDocumentationModal } from './ScriptDocumentationModal';

interface ScriptsPanelProps {
  subTab: ScriptsSubTab;
  preScript: string;
  postScript: string;
  readOnly?: boolean;
  scriptConsoleLogs?: string[];
  onPreScriptChange: (value: string) => void;
  onPostScriptChange: (value: string) => void;
}

export function ScriptsPanel({
  subTab,
  preScript,
  postScript,
  readOnly = false,
  scriptConsoleLogs = [],
  onPreScriptChange,
  onPostScriptChange,
}: ScriptsPanelProps) {
  const [showDocs, setShowDocs] = useState(false);
  const isPre = subTab === 'pre';
  const script = isPre ? preScript : postScript;
  const onChange = isPre ? onPreScriptChange : onPostScriptChange;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {isPre
            ? 'Runs before the request is sent. Use env and request.'
            : 'Runs after the response is received. Use env and response.'}
        </p>
        <button
          type="button"
          onClick={() => setShowDocs(true)}
          className="inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 text-xs rounded border border-border hover:bg-accent"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Documentation
        </button>
      </div>

      <AutomationScriptEditor
        id={isPre ? 'pre-request-script' : 'post-request-script'}
        value={script}
        readOnly={readOnly}
        placeholder={
          isPre
            ? '// Pre-request script\nconst token = env.get("token");'
            : '// Post-request script\nconst body = response.json();'
        }
        onChange={onChange}
      />

      {scriptConsoleLogs.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Console output</p>
          <pre className="text-xs font-mono leading-relaxed bg-background border border-border rounded px-2 py-1.5 max-h-32 overflow-y-auto whitespace-pre-wrap">
            {scriptConsoleLogs.join('\n')}
          </pre>
        </div>
      )}

      {showDocs && (
        <ScriptDocumentationModal scriptKind={subTab} onClose={() => setShowDocs(false)} />
      )}
    </div>
  );
}

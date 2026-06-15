import { Pencil, Plus, Trash2, BookOpen } from 'lucide-react';
import { forwardRef, useMemo, useState } from 'react';
import type { ApiResponse, ResponseTestCheck, ResponseTestResult } from '../../types';
import {
  evaluateResponseTest,
  responseTestCheckSummary,
  responseTestCheckTitle,
} from '../../lib/responseTests';
import { cn } from '../../lib/utils';
import { CollapsibleSection } from '../CollapsibleSection';
import { AddResponseTestModal } from './AddResponseTestModal';
import { EditResponseTestModal } from './EditResponseTestModal';
import { AutomationScriptEditor } from './AutomationScriptEditor';
import { ScriptTestsDocumentationModal } from './ScriptTestsDocumentationModal';

interface TestsPanelProps {
  checks: ResponseTestCheck[];
  response: ApiResponse | null;
  scriptTests?: string;
  readOnly?: boolean;
  onChange: (checks: ResponseTestCheck[]) => void;
  onScriptTestsChange: (script: string) => void;
}

export function TestsPanel({
  checks,
  response,
  scriptTests = '',
  readOnly = false,
  onChange,
  onScriptTestsChange,
}: TestsPanelProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [showScriptDocs, setShowScriptDocs] = useState(false);

  const resultsById = useMemo(() => {
    if (!response) {
      return new Map<string, ResponseTestResult>();
    }
    const map = new Map<string, ResponseTestResult>();
    for (const check of checks) {
      map.set(check.id, evaluateResponseTest(check, response));
    }
    return map;
  }, [checks, response]);

  const updateCheck = (index: number, patch: Partial<ResponseTestCheck>) => {
    const next = [...checks];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const handleDelete = (index: number) => {
    onChange(checks.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Check
        </button>
      )}

      {checks.length === 0 ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          No validation checks configured.
          <br />
          Add checks to automatically verify API responses.
        </p>
      ) : (
        <div className="space-y-0 divide-y divide-border border border-border rounded-md">
          {checks.map((check, index) => (
            <ResponseTestCheckCard
              key={check.id}
              check={check}
              result={response ? resultsById.get(check.id) : undefined}
              readOnly={readOnly}
              onToggleEnabled={(enabled) => updateCheck(index, { enabled })}
              onEdit={() => setEditIndex(index)}
              onDelete={() => handleDelete(index)}
            />
          ))}
        </div>
      )}

      <CollapsibleSection
        id="tests-advanced"
        title="Advanced"
        expanded={advancedExpanded}
        onToggle={() => setAdvancedExpanded((value) => !value)}
      >
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-medium text-foreground">Script Tests</h4>
            <button
              type="button"
              onClick={() => setShowScriptDocs(true)}
              className="inline-flex items-center gap-1.5 shrink-0 px-2 py-1 text-xs rounded border border-border hover:bg-accent"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Documentation
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Use custom JavaScript with <span className="font-mono">assert()</span> for advanced
            validation scenarios.
          </p>
          <AutomationScriptEditor
            id="script-tests"
            value={scriptTests}
            readOnly={readOnly}
            placeholder={'// Script test\nassert(response.status === 200);'}
            onChange={onScriptTestsChange}
          />
        </div>
      </CollapsibleSection>

      {showAddModal && (
        <AddResponseTestModal
          onCreate={(check) => {
            onChange([...checks, check]);
            setShowAddModal(false);
          }}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {editIndex !== null && checks[editIndex] && (
        <EditResponseTestModal
          check={checks[editIndex]}
          onSave={(updated) => {
            const next = [...checks];
            next[editIndex] = updated;
            onChange(next);
            setEditIndex(null);
          }}
          onCancel={() => setEditIndex(null)}
        />
      )}

      {showScriptDocs && (
        <ScriptTestsDocumentationModal onClose={() => setShowScriptDocs(false)} />
      )}
    </div>
  );
}

interface ResponseTestCheckCardProps {
  check: ResponseTestCheck;
  result?: ResponseTestResult;
  readOnly?: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

const IconAction = forwardRef<
  HTMLButtonElement,
  {
    icon: typeof Pencil;
    label: string;
    variant?: 'default' | 'danger';
    onClick: () => void;
  }
>(function IconAction({ icon: Icon, label, variant = 'default', onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'p-1 rounded hover:bg-accent transition-colors',
        variant === 'danger'
          ? 'text-muted-foreground hover:text-danger'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
});

function ResponseTestCheckCard({
  check,
  result,
  readOnly = false,
  onToggleEnabled,
  onEdit,
  onDelete,
}: ResponseTestCheckCardProps) {
  const title = responseTestCheckTitle(check);
  const summary = responseTestCheckSummary(check);
  const hasResult = result !== undefined && check.enabled;

  return (
    <div className={cn('px-3 py-2 bg-card', !check.enabled && 'opacity-60')}>
      <div className="flex items-start gap-2">
        {!readOnly && (
          <input
            type="checkbox"
            checked={check.enabled}
            onChange={(e) => onToggleEnabled(e.target.checked)}
            className="mt-1.5 shrink-0"
            aria-label={`Enable ${title}`}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 min-w-0">
            {hasResult && (
              <span
                className={cn(
                  'text-sm shrink-0 mt-0.5',
                  result.passed ? 'text-success' : 'text-danger'
                )}
                aria-hidden
              >
                {result.passed ? '✓' : '✗'}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium font-mono truncate">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{summary}</p>
              {hasResult && result.passed && (
                <p className="text-xs text-success mt-1">Passed</p>
              )}
              {hasResult && !result.passed && (
                <div className="text-xs mt-1 space-y-0.5">
                  {result.actual !== undefined && (
                    <p className="text-muted-foreground">
                      Actual: <span className="font-mono text-foreground">{result.actual}</span>
                    </p>
                  )}
                  {result.expected !== undefined && (
                    <p className="text-muted-foreground">
                      Expected:{' '}
                      <span className="font-mono text-foreground">{result.expected}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
            {!readOnly && (
              <div className="flex items-center gap-0.5 shrink-0">
                <IconAction icon={Pencil} label="Edit" onClick={onEdit} />
                <IconAction icon={Trash2} label="Delete" variant="danger" onClick={onDelete} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

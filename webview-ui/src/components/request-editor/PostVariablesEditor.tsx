import { Copy, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { forwardRef, useMemo, useRef, useState } from 'react';
import {
  postRequestVariableHasConfig,
  postRequestVariableTypeSummary,
  previewPostRequestVariableText,
} from '../../lib/postRequestVariables';
import type { ApiResponse, PostRequestVariable, PostRequestVariableSource } from '../../types';
import { cn } from '../../lib/utils';
import { AddPostRequestVariableModal } from './AddPostRequestVariableModal';
import { EditPostRequestVariableModal } from './EditPostRequestVariableModal';
import { PreviewPopover } from './PreviewPopover';
import { CopiedVariableToast, PreRequestUndoToast } from './PreRequestToasts';

interface PostVariablesEditorProps {
  variables: PostRequestVariable[];
  response: ApiResponse | null;
  readOnly?: boolean;
  onChange: (variables: PostRequestVariable[]) => void;
}

interface DeletedVariable {
  variable: PostRequestVariable;
  index: number;
}

const SECTIONS: { source: PostRequestVariableSource; title: string }[] = [
  { source: 'body', title: 'Response Body' },
  { source: 'headers', title: 'Response Headers' },
  { source: 'cookies', title: 'Response Cookies' },
];

export function PostVariablesEditor({
  variables,
  response,
  readOnly = false,
  onChange,
}: PostVariablesEditorProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [configIndex, setConfigIndex] = useState<number | null>(null);
  const [previewKey, setPreviewKey] = useState<number | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<DeletedVariable | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const existingNames = useMemo(
    () => variables.map((variable) => variable.name.trim()).filter(Boolean),
    [variables]
  );

  const updateVariable = (index: number, patch: Partial<PostRequestVariable>) => {
    const next = [...variables];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const handleDelete = (index: number) => {
    setDeleted({ variable: variables[index], index });
    onChange(variables.filter((_, i) => i !== index));
    setPreviewKey(null);
    setPreviewText(null);
  };

  const handleUndoDelete = () => {
    if (!deleted) {
      return;
    }
    const next = [...variables];
    next.splice(deleted.index, 0, deleted.variable);
    onChange(next);
    setDeleted(null);
  };

  const handlePreview = (index: number) => {
    const variable = variables[index];
    if (!variable.name.trim()) {
      return;
    }
    setPreviewKey(index);
    setPreviewText(previewPostRequestVariableText(variable, response));
  };

  const copyVariableToken = async (name: string) => {
    const token = `{{${name}}}`;
    try {
      await navigator.clipboard.writeText(token);
      setCopiedToken(token);
    } catch {
      setCopiedToken(null);
    }
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
          Extract Variable
        </button>
      )}

      {variables.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Extract values from the latest response to reuse in URL, headers, body, or authentication.
        </p>
      ) : (
        SECTIONS.map(({ source, title }) => {
          const sectionVariables = variables
            .map((variable, index) => ({ variable, index }))
            .filter(({ variable }) => variable.source === source);
          if (sectionVariables.length === 0) {
            return null;
          }
          return (
            <section key={source} className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
              <div className="space-y-0 divide-y divide-border border border-border rounded-md">
                {sectionVariables.map(({ variable, index }) => (
                  <PostVariableCard
                    key={index}
                    variable={variable}
                    readOnly={readOnly}
                    previewOpen={previewKey === index}
                    previewValue={previewKey === index ? previewText : null}
                    onNameChange={(name) => updateVariable(index, { name })}
                    onToggleEnabled={(enabled) => updateVariable(index, { enabled })}
                    onConfigure={() => setConfigIndex(index)}
                    onCopy={() => copyVariableToken(variable.name.trim())}
                    onPreview={() => handlePreview(index)}
                    onClosePreview={() => {
                      setPreviewKey(null);
                      setPreviewText(null);
                    }}
                    onDelete={() => handleDelete(index)}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      {showAddModal && (
        <AddPostRequestVariableModal
          existingNames={existingNames}
          onCreate={(variable) => {
            onChange([...variables, variable]);
            setShowAddModal(false);
          }}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {configIndex !== null && variables[configIndex] && (
        <EditPostRequestVariableModal
          variable={variables[configIndex]}
          onSave={(patch) => {
            updateVariable(configIndex, patch);
            setConfigIndex(null);
          }}
          onCancel={() => setConfigIndex(null)}
        />
      )}

      {deleted && (
        <PreRequestUndoToast
          variableName={deleted.variable.name}
          onUndo={handleUndoDelete}
          onDismiss={() => setDeleted(null)}
        />
      )}

      {copiedToken && (
        <CopiedVariableToast token={copiedToken} onDismiss={() => setCopiedToken(null)} />
      )}
    </div>
  );
}

interface PostVariableCardProps {
  variable: PostRequestVariable;
  readOnly?: boolean;
  previewOpen: boolean;
  previewValue: string | null;
  onNameChange: (name: string) => void;
  onToggleEnabled: (enabled: boolean) => void;
  onConfigure: () => void;
  onCopy: () => void;
  onPreview: () => void;
  onClosePreview: () => void;
  onDelete: () => void;
}

const IconAction = forwardRef<
  HTMLButtonElement,
  {
    icon: typeof Copy;
    label: string;
    disabled?: boolean;
    active?: boolean;
    variant?: 'default' | 'danger';
    onClick: () => void;
  }
>(function IconAction(
  { icon: Icon, label, disabled = false, active = false, variant = 'default', onClick },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        'p-1 rounded hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none',
        active && 'bg-accent text-foreground',
        variant === 'danger'
          ? 'text-muted-foreground hover:text-danger'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
});

function PostVariableCard({
  variable,
  readOnly = false,
  previewOpen,
  previewValue,
  onNameChange,
  onToggleEnabled,
  onConfigure,
  onCopy,
  onPreview,
  onClosePreview,
  onDelete,
}: PostVariableCardProps) {
  const previewButtonRef = useRef<HTMLButtonElement>(null);
  const typeSummary = postRequestVariableTypeSummary(variable);
  const canConfigure = postRequestVariableHasConfig(variable);
  const hasName = Boolean(variable.name.trim());

  return (
    <div className={cn('px-3 py-2 bg-card', !variable.enabled && 'opacity-60')}>
      <div className="flex items-start gap-2">
        {!readOnly && (
          <input
            type="checkbox"
            checked={variable.enabled}
            onChange={(e) => onToggleEnabled(e.target.checked)}
            className="mt-1.5 shrink-0"
            aria-label={`Enable ${variable.name || 'variable'}`}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            {readOnly ? (
              <p className="flex-1 min-w-0 text-sm font-medium font-mono truncate">
                {variable.name || 'Unnamed'}
              </p>
            ) : (
              <input
                type="text"
                value={variable.name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="variableName"
                className="flex-1 min-w-0 text-sm font-medium font-mono bg-transparent border-0 border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-0 py-0.5"
              />
            )}
            <div className="flex items-center shrink-0 gap-0.5">
              <IconAction icon={Copy} label="Copy" disabled={!hasName} onClick={onCopy} />
              <IconAction
                ref={previewButtonRef}
                icon={Eye}
                label="Preview"
                disabled={!hasName}
                active={previewOpen}
                onClick={() => (previewOpen ? onClosePreview() : onPreview())}
              />
              {!readOnly && (
                <IconAction icon={Trash2} label="Delete" variant="danger" onClick={onDelete} />
              )}
            </div>
          </div>
          {canConfigure && !readOnly ? (
            <button
              type="button"
              onClick={onConfigure}
              className="text-xs text-muted-foreground hover:text-foreground text-left inline-flex items-center gap-1 mt-0.5"
              title="Edit extraction"
            >
              <Pencil className="w-3 h-3 shrink-0 opacity-60" />
              {typeSummary}
            </button>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">{typeSummary}</p>
          )}
        </div>
      </div>

      {previewOpen && previewValue !== null && previewButtonRef.current && (
        <PreviewPopover
          anchor={previewButtonRef.current}
          value={previewValue}
          onClose={onClosePreview}
        />
      )}
    </div>
  );
}

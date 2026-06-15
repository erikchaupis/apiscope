import { Copy, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { forwardRef, useMemo, useRef, useState } from 'react';
import {
  preRequestVariableHasConfig,
  preRequestVariableTypeSummary,
  previewPreRequestValue,
} from '../../lib/preRequestVariables';
import type { PreRequestVariable } from '../../types';
import { cn } from '../../lib/utils';
import { AddPreRequestVariableModal } from './AddPreRequestVariableModal';
import { EditPreRequestVariableConfigModal } from './EditPreRequestVariableConfigModal';
import { PreviewPopover } from './PreviewPopover';
import { CopiedVariableToast, PreRequestUndoToast } from './PreRequestToasts';

interface PreRequestVariablesEditorProps {
  variables: PreRequestVariable[];
  readOnly?: boolean;
  onChange: (variables: PreRequestVariable[]) => void;
}

interface DeletedVariable {
  variable: PreRequestVariable;
  index: number;
}

export function PreRequestVariablesEditor({
  variables,
  readOnly = false,
  onChange,
}: PreRequestVariablesEditorProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [configIndex, setConfigIndex] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewValue, setPreviewValue] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<DeletedVariable | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const existingNames = useMemo(
    () => variables.map((variable) => variable.name.trim()).filter(Boolean),
    [variables]
  );

  const updateVariable = (index: number, patch: Partial<PreRequestVariable>) => {
    const next = [...variables];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const handleDelete = (index: number) => {
    const variable = variables[index];
    setDeleted({ variable, index });
    onChange(variables.filter((_, i) => i !== index));
    setPreviewIndex(null);
    setPreviewValue(null);
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
    setPreviewIndex(index);
    setPreviewValue(previewPreRequestValue(variable));
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
          Add Variable
        </button>
      )}

      {variables.length > 0 && (
        <div className="space-y-0 divide-y divide-border border border-border rounded-md">
          {variables.map((variable, index) => (
            <VariableCard
              key={index}
              variable={variable}
              readOnly={readOnly}
              previewOpen={previewIndex === index}
              previewValue={previewIndex === index ? previewValue : null}
              onNameChange={(name) => updateVariable(index, { name })}
              onToggleEnabled={(enabled) => updateVariable(index, { enabled })}
              onConfigure={() => setConfigIndex(index)}
              onCopy={() => copyVariableToken(variable.name.trim())}
              onPreview={() => handlePreview(index)}
              onClosePreview={() => {
                setPreviewIndex(null);
                setPreviewValue(null);
              }}
              onDelete={() => handleDelete(index)}
            />
          ))}
        </div>
      )}

      {variables.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add variables to generate dynamic values before each request is sent.
        </p>
      )}

      {showAddModal && (
        <AddPreRequestVariableModal
          existingNames={existingNames}
          onCreate={(variable) => {
            onChange([...variables, variable]);
            setShowAddModal(false);
          }}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {configIndex !== null && variables[configIndex] && (
        <EditPreRequestVariableConfigModal
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

interface VariableCardProps {
  variable: PreRequestVariable;
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

function VariableCard({
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
}: VariableCardProps) {
  const previewButtonRef = useRef<HTMLButtonElement>(null);
  const typeSummary = preRequestVariableTypeSummary(variable);
  const canConfigure = preRequestVariableHasConfig(variable);
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
            title={variable.enabled ? 'Enabled' : 'Disabled'}
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
              title="Edit configuration"
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

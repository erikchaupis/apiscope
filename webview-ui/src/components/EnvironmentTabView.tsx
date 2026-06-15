import { Check, Eye, MoreHorizontal, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_ENVIRONMENT_TIER,
  ENVIRONMENT_TIERS,
  type Environment,
  type EnvironmentTier,
  type EnvironmentVariable,
} from '../types';
import {
  displayVariableValue,
  environmentHeaderLabel,
  environmentListLabel,
  environmentTierLabel,
  sortEnvironmentsForList,
} from '../lib/environmentUtils';
import { cn } from '../lib/utils';
import { CopyVariableModal } from './CopyVariableModal';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { DeleteEnvironmentModal } from './DeleteEnvironmentModal';
import { EnvironmentTierBadge } from './EnvironmentTierBadge';

interface EnvironmentTabViewProps {
  environments: Environment[];
  activeEnvironmentId: string;
  runtimeVariables: EnvironmentVariable[];
  onSetActiveEnvironment: (environmentId: string) => void;
  onCreate: (name: string, environmentType: EnvironmentTier) => void;
  onSetEnvironmentType: (environmentId: string, environmentType: EnvironmentTier) => void;
  onRename: (environmentId: string, name: string) => void;
  onDuplicate: (environmentId: string) => void;
  onDelete: (environmentId: string) => void;
  onSaveVariables: (environmentId: string, variables: EnvironmentVariable[]) => void;
  onCopyVariable: (
    sourceEnvironmentId: string,
    variable: EnvironmentVariable,
    targetEnvironmentIds: string[],
    overwriteExisting: boolean
  ) => void;
  onClearRuntimeVariables: () => void;
  onDeleteRuntimeVariable: (name: string) => void;
  onPromoteRuntimeVariable: (name: string, environmentId: string) => void;
}

export function EnvironmentTabView({
  environments,
  activeEnvironmentId,
  runtimeVariables,
  onSetActiveEnvironment,
  onCreate,
  onSetEnvironmentType,
  onRename,
  onDuplicate,
  onDelete,
  onSaveVariables,
  onCopyVariable,
  onClearRuntimeVariables,
  onDeleteRuntimeVariable,
  onPromoteRuntimeVariable,
}: EnvironmentTabViewProps) {
  const [selectedId, setSelectedId] = useState(activeEnvironmentId);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<EnvironmentTier>(DEFAULT_ENVIRONMENT_TIER);
  const [renameValue, setRenameValue] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Environment | null>(null);
  const [showSensitiveValues, setShowSensitiveValues] = useState(false);
  const [focusedValueIndex, setFocusedValueIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowMenu, setRowMenu] = useState<{ index: number; x: number; y: number } | null>(null);
  const [copyVariableIndex, setCopyVariableIndex] = useState<number | null>(null);
  const [runtimeRowMenu, setRuntimeRowMenu] = useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);
  const rowMenuButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const runtimeRowMenuButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const selected = environments.find((e) => e.id === selectedId) ?? environments[0];
  const [variables, setVariables] = useState<EnvironmentVariable[]>(
    () => selected?.variables ?? []
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const prevSelectedId = useRef(selectedId);

  const sortedEnvironments = sortEnvironmentsForList(environments);
  const isGenerated = selected?.source === 'generated';
  const canDelete = selected?.source === 'user' && environments.length > 1;
  const hasSensitive = variables.some((v) => v.sensitive);
  const hasDraftRows = variables.some((v) => !v.name.trim());

  useEffect(() => {
    if (!environments.some((e) => e.id === selectedId)) {
      setSelectedId(activeEnvironmentId);
    }
  }, [environments, selectedId, activeEnvironmentId]);

  useEffect(() => {
    const env = environments.find((e) => e.id === selectedId) ?? environments[0];
    if (!env) {
      return;
    }

    const switched = prevSelectedId.current !== selectedId;
    prevSelectedId.current = selectedId;
    skipSave.current = true;

    if (switched) {
      setVariables(env.variables);
    } else {
      setVariables((current) => {
        const drafts = current.filter((v) => !v.name.trim());
        return drafts.length > 0 ? [...env.variables, ...drafts] : env.variables;
      });
    }
    setFocusedValueIndex(null);
  }, [environments, selectedId]);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    if (hasDraftRows) {
      return;
    }
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(() => {
      onSaveVariables(selectedId, variables);
    }, 400);
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [variables, selectedId, onSaveVariables, hasDraftRows]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const selectEnvironment = (id: string) => {
    const env = environments.find((e) => e.id === id);
    prevSelectedId.current = id;
    setSelectedId(id);
    skipSave.current = true;
    setVariables(env?.variables ?? []);
    setRenamingId(null);
    setMenuOpen(false);
    setFocusedValueIndex(null);
    setError(null);
  };

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError('Environment name cannot be empty.');
      return;
    }
    onCreate(trimmed, newType);
    setNewName('');
    setNewType(DEFAULT_ENVIRONMENT_TIER);
    setCreating(false);
    setError(null);
  };

  const handleRename = (id: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setError('Environment name cannot be empty.');
      return;
    }
    onRename(id, trimmed);
    setRenamingId(null);
    setMenuOpen(false);
    setError(null);
  };

  const updateVariable = (index: number, field: 'name' | 'value', value: string) => {
    const next = [...variables];
    next[index] = { ...next[index], [field]: value };
    setVariables(next);
  };

  const updateVariableSensitive = (index: number, sensitive: boolean) => {
    const next = [...variables];
    const current = next[index];
    if (sensitive) {
      next[index] = { ...current, sensitive: true };
    } else {
      const { sensitive: _removed, ...rest } = current;
      next[index] = rest;
    }
    setVariables(next);
  };

  const addVariable = () => {
    setVariables([...variables, { name: '', value: '' }]);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
    setRowMenu(null);
  };

  const openRowMenu = (index: number) => {
    const button = rowMenuButtonRefs.current.get(index);
    if (!button) {
      return;
    }
    const rect = button.getBoundingClientRect();
    setRowMenu({ index, x: rect.right - 168, y: rect.bottom + 4 });
  };

  const copyRuntimeValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError('Could not copy value to clipboard.');
    }
  };

  const openRuntimeRowMenu = (index: number) => {
    const button = runtimeRowMenuButtonRefs.current.get(index);
    if (!button) {
      return;
    }
    const rect = button.getBoundingClientRect();
    setRuntimeRowMenu({ index, x: rect.right - 168, y: rect.bottom + 4 });
  };

  const runtimeRowMenuItems = (index: number): ContextMenuItem[] => {
    const variable = runtimeVariables[index];
    return [
      {
        id: 'copy-value',
        label: 'Copy Value',
        onClick: () => {
          void copyRuntimeValue(variable?.value ?? '');
        },
      },
      {
        id: 'promote',
        label: 'Promote to Environment Variable',
        disabled: !selected,
        onClick: () => {
          if (variable?.name.trim() && selected) {
            onPromoteRuntimeVariable(variable.name, selected.id);
          }
        },
      },
      { id: 'separator', separator: true },
      {
        id: 'delete',
        label: 'Delete Variable',
        danger: true,
        onClick: () => {
          if (variable?.name.trim()) {
            onDeleteRuntimeVariable(variable.name);
          }
        },
      },
    ];
  };

  const rowMenuItems = (index: number): ContextMenuItem[] => {
    const variable = variables[index];
    const canCopy = Boolean(variable?.name.trim());
    return [
      {
        id: 'copy-to',
        label: 'Copy To...',
        disabled: !canCopy,
        onClick: () => setCopyVariableIndex(index),
      },
      { id: 'separator', separator: true },
      {
        id: 'delete',
        label: 'Delete',
        danger: true,
        onClick: () => removeVariable(index),
      },
    ];
  };

  const confirmDelete = () => {
    if (!deleteTarget) {
      return;
    }
    onDelete(deleteTarget.id);
    if (selectedId === deleteTarget.id) {
      const fallback =
        environments.find((e) => e.id === activeEnvironmentId && e.id !== deleteTarget.id) ??
        environments.find((e) => e.id !== deleteTarget.id);
      if (fallback) {
        selectEnvironment(fallback.id);
      }
    }
    setDeleteTarget(null);
    setMenuOpen(false);
  };

  return (
    <>
      <div className="flex flex-1 min-h-0 min-w-0">
        <div className="w-72 shrink-0 border-r border-border flex flex-col min-h-0 overflow-hidden bg-card">
          <div className="px-3 py-2 border-b border-border shrink-0 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Environments
            </span>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="p-0.5 rounded hover:bg-[var(--as-tree-hover)] text-muted-foreground hover:text-foreground"
              title="New Environment"
              aria-label="New Environment"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto py-1">
            {sortedEnvironments.map((env) => {
              const isActive = env.id === activeEnvironmentId;
              const isSelected = env.id === selectedId;
              const label = environmentListLabel(env);

              return (
                <div key={env.id}>
                  {renamingId === env.id ? (
                    <div className="px-2 py-1">
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="w-full text-xs bg-background border border-border rounded px-1.5 py-0.5"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRename(env.id);
                          }
                          if (e.key === 'Escape') {
                            setRenamingId(null);
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => selectEnvironment(env.id)}
                      className={cn(
                        'w-full text-left px-2 py-1.5 text-xs hover:bg-[var(--as-tree-hover)] min-w-0 flex items-center gap-1.5',
                        isSelected && 'bg-[var(--as-tree-selected)]',
                        isActive && 'env-list-item-active'
                      )}
                      title={isActive ? `${label} (active)` : label}
                    >
                      <EnvironmentTierBadge tier={env.environmentType} />
                      <span className="truncate font-mono flex-1 min-w-0">{label}</span>
                      {isActive && (
                        <Check className="w-3 h-3 shrink-0 text-success" aria-label="Active" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {creating && (
            <div className="border-t border-border p-2 shrink-0 space-y-2">
              <input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setError(null);
                }}
                placeholder="Environment name"
                className="w-full text-xs bg-background border border-border rounded px-2 py-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreate();
                  }
                  if (e.key === 'Escape') {
                    setCreating(false);
                    setNewName('');
                  }
                }}
              />
              <label className="block text-[10px] text-muted-foreground uppercase tracking-wide">
                Environment Type
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as EnvironmentTier)}
                className="w-full text-xs bg-background border border-border rounded px-2 py-1"
              >
                {ENVIRONMENT_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {environmentTierLabel(tier)}
                  </option>
                ))}
              </select>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleCreate}
                  className="flex-1 text-xs px-2 py-1 rounded bg-primary text-background font-medium"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setNewName('');
                    setNewType(DEFAULT_ENVIRONMENT_TIER);
                  }}
                  className="flex-1 text-xs px-2 py-1 rounded border border-border hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
          {selected ? (
            <div className="flex flex-col flex-1 min-h-0 p-4 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3 shrink-0 flex-wrap">
                <EnvironmentTierBadge tier={selected.environmentType} />
                <span className="text-sm font-medium truncate">
                  {environmentHeaderLabel(selected)}
                </span>
                {selected.id === activeEnvironmentId ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--as-tab-environment-bg)] text-[var(--as-tab-environment-fg)] shrink-0">
                    Active
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSetActiveEnvironment(selected.id)}
                    className="text-xs px-2 py-0.5 rounded border border-border hover:bg-accent shrink-0"
                  >
                    Set as Active
                  </button>
                )}
                <div className="relative ml-auto shrink-0" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    className="p-1 rounded border border-border hover:bg-accent text-muted-foreground hover:text-foreground"
                    title="Environment actions"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-full z-30 mt-1 min-w-[168px] rounded border border-border bg-card shadow-lg text-xs py-1">
                      {!isGenerated && (
                        <button
                          type="button"
                          className="w-full px-2 py-1.5 hover:bg-accent text-left"
                          onClick={() => {
                            setRenamingId(selected.id);
                            setRenameValue(selected.name);
                            setMenuOpen(false);
                          }}
                        >
                          Rename
                        </button>
                      )}
                      <button
                        type="button"
                        className="w-full px-2 py-1.5 hover:bg-accent text-left"
                        onClick={() => {
                          onDuplicate(selected.id);
                          setMenuOpen(false);
                        }}
                      >
                        Duplicate
                      </button>
                      {canDelete && (
                        <>
                          <div className="my-1 border-t border-border" />
                          <button
                            type="button"
                            className="w-full px-2 py-1.5 hover:bg-accent text-left text-danger"
                            onClick={() => {
                              setDeleteTarget(selected);
                              setMenuOpen(false);
                            }}
                          >
                            Delete Environment
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3 shrink-0">
                <span className="text-xs text-muted-foreground shrink-0">Environment Type</span>
                <select
                  value={selected.environmentType}
                  onChange={(e) =>
                    onSetEnvironmentType(selected.id, e.target.value as EnvironmentTier)
                  }
                  disabled={isGenerated}
                  className="text-xs bg-background border border-border rounded px-2 py-1"
                  title={isGenerated ? 'Generated environment is always Local' : undefined}
                >
                  {ENVIRONMENT_TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {environmentTierLabel(tier)}
                    </option>
                  ))}
                </select>
              </div>

              {hasSensitive && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 cursor-pointer select-none shrink-0">
                  <Eye className="w-3.5 h-3.5" />
                  <input
                    type="checkbox"
                    checked={showSensitiveValues}
                    onChange={(e) => setShowSensitiveValues(e.target.checked)}
                    className="rounded border-border"
                  />
                  Show Sensitive Values
                </label>
              )}

              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 shrink-0">
                Environment Variables
              </h3>
              <div className="grid grid-cols-[minmax(5rem,1fr)_2fr_4.5rem_auto] gap-2 text-xs text-muted-foreground mb-1 px-0.5 shrink-0">
                <span>Name</span>
                <span>Value</span>
                <span className="text-center">Sensitive</span>
                <span className="text-center w-8">Actions</span>
              </div>
              <div className="space-y-1.5 mb-3">
                {variables.map((v, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[minmax(5rem,1fr)_2fr_4.5rem_auto] gap-2 min-w-0 items-center"
                  >
                    <input
                      value={v.name}
                      onChange={(e) => updateVariable(i, 'name', e.target.value)}
                      placeholder="name"
                      className="text-xs font-mono bg-background border border-border rounded px-2 py-1 min-w-0"
                    />
                    <input
                      value={displayVariableValue(v, showSensitiveValues, focusedValueIndex === i)}
                      onChange={(e) => updateVariable(i, 'value', e.target.value)}
                      onFocus={() => setFocusedValueIndex(i)}
                      onBlur={() => setFocusedValueIndex(null)}
                      placeholder="value"
                      className="text-xs font-mono bg-background border border-border rounded px-2 py-1 min-w-0"
                    />
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={Boolean(v.sensitive)}
                        onChange={(e) => updateVariableSensitive(i, e.target.checked)}
                        className="rounded border-border"
                        title="Sensitive"
                      />
                    </div>
                    <button
                      type="button"
                      ref={(el) => {
                        if (el) {
                          rowMenuButtonRefs.current.set(i, el);
                        } else {
                          rowMenuButtonRefs.current.delete(i);
                        }
                      }}
                      onClick={() => openRowMenu(i)}
                      className="p-0.5 text-muted-foreground hover:text-foreground justify-self-center"
                      title="Variable actions"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addVariable}
                className="text-xs flex items-center gap-0.5 text-muted-foreground hover:text-foreground shrink-0"
              >
                <Plus className="w-3 h-3" /> Add Variable
              </button>

              <div className="mt-8 pt-6 border-t border-border shrink-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Runtime Variables (Memory Only)
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1.5 max-w-xl">
                      Runtime Variables are stored in memory and generated during request execution.
                      They are available across requests but are not saved to disk and will be cleared
                      when API Scope closes.
                    </p>
                  </div>
                  {runtimeVariables.length > 0 && (
                    <button
                      type="button"
                      onClick={onClearRuntimeVariables}
                      className="text-xs px-2 py-1 rounded border border-border hover:bg-accent text-muted-foreground hover:text-foreground shrink-0"
                    >
                      Clear Runtime Variables
                    </button>
                  )}
                </div>
                {runtimeVariables.length > 0 ? (
                  <>
                    <div className="grid grid-cols-[minmax(5rem,1fr)_2fr_auto] gap-2 text-xs text-muted-foreground mb-1 px-0.5">
                      <span>Name</span>
                      <span>Value</span>
                      <span className="text-center w-8">Actions</span>
                    </div>
                    <div className="space-y-1.5">
                      {runtimeVariables.map((v, i) => (
                        <div
                          key={`${v.name}-${i}`}
                          className="grid grid-cols-[minmax(5rem,1fr)_2fr_auto] gap-2 min-w-0 items-center"
                        >
                          <span className="text-xs font-mono px-2 py-1 truncate">{v.name}</span>
                          <span className="text-xs font-mono px-2 py-1 truncate text-muted-foreground bg-muted/30 border border-border rounded">
                            {v.value}
                          </span>
                          <button
                            type="button"
                            ref={(el) => {
                              if (el) {
                                runtimeRowMenuButtonRefs.current.set(i, el);
                              } else {
                                runtimeRowMenuButtonRefs.current.delete(i);
                              }
                            }}
                            onClick={() => openRuntimeRowMenu(i)}
                            className="p-0.5 text-muted-foreground hover:text-foreground justify-self-center"
                            title="Runtime variable actions"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No runtime variables yet.</p>
                )}
              </div>

              {error && <p className="text-xs text-danger mt-3">{error}</p>}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground p-6">
              Create an environment to manage variables.
            </div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <DeleteEnvironmentModal
          name={deleteTarget.name}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {rowMenu && (
        <ContextMenu
          x={rowMenu.x}
          y={rowMenu.y}
          items={rowMenuItems(rowMenu.index)}
          onClose={() => setRowMenu(null)}
        />
      )}

      {runtimeRowMenu && (
        <ContextMenu
          x={runtimeRowMenu.x}
          y={runtimeRowMenu.y}
          items={runtimeRowMenuItems(runtimeRowMenu.index)}
          onClose={() => setRuntimeRowMenu(null)}
        />
      )}

      {copyVariableIndex !== null && selected && variables[copyVariableIndex] && (
        <CopyVariableModal
          sourceEnvironment={selected}
          variable={variables[copyVariableIndex]}
          environments={environments}
          showSensitiveValues={showSensitiveValues}
          onCancel={() => setCopyVariableIndex(null)}
          onCopy={(targetEnvironmentIds, overwriteExisting) => {
            onCopyVariable(
              selected.id,
              variables[copyVariableIndex],
              targetEnvironmentIds,
              overwriteExisting
            );
            setCopyVariableIndex(null);
          }}
        />
      )}
    </>
  );
}

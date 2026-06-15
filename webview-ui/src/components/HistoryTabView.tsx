import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AppTheme, AuthStatus, HistoryEntry, HistoryIndexEntry, RequestResponseLayoutMode } from '../types';
import {
  defaultExpandedHistoryDays,
  formatHistoryTime,
  groupHistoryByDay,
  groupHistoryBySignature,
} from '../lib/historyGroups';
import { cn, methodClass } from '../lib/utils';
import { HistoryExecutionPanel } from './HistoryExecutionPanel';

interface HistoryListPanelProps {
  entries: HistoryIndexEntry[];
  selectedHistoryId: string | null;
  savedExpandedDays?: string[];
  savedExpandedSignatures?: string[];
  onExpandedStateChange: (days: string[], signatures: string[]) => void;
  onSelectEntry: (historyId: string) => void;
  onCreateDraftFromEntry: (historyId: string) => void;
}

function HistoryListPanel({
  entries,
  selectedHistoryId,
  savedExpandedDays,
  savedExpandedSignatures,
  onExpandedStateChange,
  onSelectEntry,
  onCreateDraftFromEntry,
}: HistoryListPanelProps) {
  const dayGroups = useMemo(() => groupHistoryByDay(entries), [entries]);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(
    () => new Set(savedExpandedDays ?? defaultExpandedHistoryDays(dayGroups))
  );
  const [expandedSignatures, setExpandedSignatures] = useState<Set<string>>(
    () => new Set(savedExpandedSignatures ?? [])
  );

  useEffect(() => {
    if (savedExpandedDays) {
      setExpandedDays(new Set(savedExpandedDays));
    }
  }, [savedExpandedDays]);

  useEffect(() => {
    if (savedExpandedSignatures) {
      setExpandedSignatures(new Set(savedExpandedSignatures));
    }
  }, [savedExpandedSignatures]);

  const persistExpanded = (days: Set<string>, signatures: Set<string>) => {
    onExpandedStateChange([...days], [...signatures]);
  };

  const toggleDay = (dayKey: string) => {
    const next = new Set(expandedDays);
    if (next.has(dayKey)) {
      next.delete(dayKey);
    } else {
      next.add(dayKey);
    }
    setExpandedDays(next);
    persistExpanded(next, expandedSignatures);
  };

  const toggleSignature = (key: string) => {
    const next = new Set(expandedSignatures);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpandedSignatures(next);
    persistExpanded(expandedDays, next);
  };

  return (
    <div className="w-60 shrink-0 border-r border-border flex flex-col min-h-0 overflow-hidden bg-card">
      <div className="px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Executions
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {entries.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            No executions yet. Send a request to create history entries.
          </p>
        ) : (
          dayGroups.map((day) => {
            const isDayOpen = expandedDays.has(day.dayKey);
            const signatureGroups = groupHistoryBySignature(day.entries);
            return (
              <div key={day.dayKey}>
                <button
                  type="button"
                  onClick={() => toggleDay(day.dayKey)}
                  className="w-full flex items-center gap-1 px-2 py-1.5 text-sm font-medium hover:bg-[var(--as-tree-hover)]"
                >
                  {isDayOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{day.label}</span>
                  <span className="text-muted-foreground text-xs tabular-nums shrink-0">
                    ({day.entries.length})
                  </span>
                </button>
                {isDayOpen &&
                  signatureGroups.map((group) => {
                    const sigKey = `${day.dayKey}:${group.signature}`;
                    const isSigOpen = expandedSignatures.has(sigKey);
                    return (
                      <div key={sigKey}>
                        <button
                          type="button"
                          onClick={() => toggleSignature(sigKey)}
                          className="w-full flex items-center gap-1 pl-5 pr-2 py-1 text-sm hover:bg-[var(--as-tree-hover)] min-w-0"
                        >
                          {isSigOpen ? (
                            <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
                          )}
                          <span
                            className={cn(
                              'text-[11px] font-semibold shrink-0',
                              methodClass(group.method as import('../types').HttpMethod)
                            )}
                          >
                            {group.method}
                          </span>
                          <span className="truncate font-mono text-xs">{group.path}</span>
                          <span className="text-muted-foreground text-xs tabular-nums shrink-0">
                            ({group.entries.length})
                          </span>
                        </button>
                        {isSigOpen &&
                          group.entries.map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => onSelectEntry(entry.id)}
                              onDoubleClick={(e) => {
                                e.preventDefault();
                                onCreateDraftFromEntry(entry.id);
                              }}
                              className={cn(
                                'w-full text-left pl-9 pr-2 py-1 text-xs font-mono hover:bg-[var(--as-tree-hover)]',
                                selectedHistoryId === entry.id && 'bg-[var(--as-tree-selected)]'
                              )}
                              title="Single click: view · Double click: create draft"
                            >
                              {formatHistoryTime(entry.timestamp)}
                            </button>
                          ))}
                      </div>
                    );
                  })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

interface HistoryTabViewProps {
  entries: HistoryIndexEntry[];
  selectedHistoryId: string | null;
  historyEntry: HistoryEntry | null;
  savedExpandedDays?: string[];
  savedExpandedSignatures?: string[];
  theme: AppTheme;
  authStatus: AuthStatus;
  layout: RequestResponseLayoutMode;
  onExpandedStateChange: (days: string[], signatures: string[]) => void;
  onSelectEntry: (historyId: string) => void;
  onCreateDraftFromEntry: (historyId: string) => void;
}

export function HistoryTabView({
  entries,
  selectedHistoryId,
  historyEntry,
  savedExpandedDays,
  savedExpandedSignatures,
  theme,
  authStatus,
  layout,
  onExpandedStateChange,
  onSelectEntry,
  onCreateDraftFromEntry,
}: HistoryTabViewProps) {
  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      <HistoryListPanel
        entries={entries}
        selectedHistoryId={selectedHistoryId}
        savedExpandedDays={savedExpandedDays}
        savedExpandedSignatures={savedExpandedSignatures}
        onExpandedStateChange={onExpandedStateChange}
        onSelectEntry={onSelectEntry}
        onCreateDraftFromEntry={onCreateDraftFromEntry}
      />
      <div className="flex flex-col flex-1 min-h-0 min-w-0">
        {historyEntry ? (
          <HistoryExecutionPanel
            entry={historyEntry}
            authStatus={authStatus}
            theme={theme}
            layout={layout}
            onCreateDraft={() => onCreateDraftFromEntry(historyEntry.id)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground p-6">
            Select an execution to view request and response details.
          </div>
        )}
      </div>
    </div>
  );
}

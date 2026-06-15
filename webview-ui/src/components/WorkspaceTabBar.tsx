import { X } from 'lucide-react';
import type { WorkspaceTab } from '../types';
import { cn, tabTypeLabel, tabTypeTagClass } from '../lib/utils';

interface WorkspaceTabBarProps {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
}

export function WorkspaceTabBar({ tabs, activeTabId, onSelectTab, onCloseTab }: WorkspaceTabBarProps) {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="flex shrink-0 border-b border-border bg-card overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={cn(
              'group workspace-tab flex items-center gap-1 max-w-[240px] shrink-0 border-r border-border',
              isActive ? 'workspace-tab-active' : 'workspace-tab-inactive'
            )}
          >
            <button
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={cn(
                'flex flex-1 min-w-0 items-center gap-1.5 px-2 py-1.5 text-xs text-left',
                isActive ? 'text-foreground' : 'text-muted-foreground'
              )}
              title={tab.tooltip ?? tab.title}
            >
              <span
                className={cn(
                  'shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded leading-none',
                  tabTypeTagClass(tab.type),
                  !isActive && 'opacity-75'
                )}
              >
                {tabTypeLabel(tab.type)}
              </span>
              <span className="truncate">{tab.title}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              className="p-1 mr-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent text-muted-foreground hover:text-foreground shrink-0"
              title="Close tab"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

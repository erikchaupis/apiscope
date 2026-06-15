import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  environmentListLabel,
  sortEnvironmentsForList,
} from '../lib/environmentUtils';
import { cn } from '../lib/utils';
import type { Environment } from '../types';
import { EnvironmentTierBadge } from './EnvironmentTierBadge';

interface EnvironmentSelectorProps {
  environments: Environment[];
  activeEnvironmentId: string;
  onSelectEnvironment: (id: string) => void;
  /** When grouped with a manage button, drop outer border/radius on the left side. */
  variant?: 'default' | 'segment-left';
}

interface MenuPosition {
  top: number;
  left: number;
  minWidth: number;
}

export function EnvironmentSelector({
  environments,
  activeEnvironmentId,
  onSelectEnvironment,
  variant = 'default',
}: EnvironmentSelectorProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const active =
    environments.find((e) => e.id === activeEnvironmentId) ?? environments[0];
  const sorted = sortEnvironmentsForList(environments);
  const isSegment = variant === 'segment-left';

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const minWidth = Math.max(240, rect.width);
    const left = Math.max(8, Math.min(rect.right - minWidth, window.innerWidth - minWidth - 8));
    setMenuPosition({
      top: rect.bottom + 4,
      left,
      minWidth,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    updateMenuPosition();
    const handleReposition = () => updateMenuPosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!active) {
    return null;
  }

  const menu =
    open && menuPosition
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label="Environments"
            className="fixed z-[9999] max-w-[320px] rounded border border-border bg-card shadow-lg py-1"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              minWidth: menuPosition.minWidth,
            }}
          >
            {sorted.map((env) => {
              const isActive = env.id === activeEnvironmentId;
              return (
                <button
                  key={env.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    onSelectEnvironment(env.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left hover:bg-[var(--as-tree-hover)] min-w-0',
                    isActive && 'bg-[var(--as-tree-selected)] env-list-item-active'
                  )}
                >
                  <EnvironmentTierBadge tier={env.environmentType} />
                  <span className="truncate font-mono flex-1 min-w-0">
                    {environmentListLabel(env)}
                  </span>
                  {isActive && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-success shrink-0">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex items-center gap-1.5 text-xs bg-background px-2 py-1 hover:bg-accent min-w-0',
          isSegment
            ? 'flex-1 rounded-l border-0 h-full min-w-[140px]'
            : 'border border-border rounded max-w-[220px]'
        )}
        title="Select active environment"
      >
        <EnvironmentTierBadge tier={active.environmentType} />
        <span className="truncate">{environmentListLabel(active)}</span>
        <ChevronDown
          className={cn(
            'w-3 h-3 shrink-0 text-muted-foreground ml-auto transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {menu}
    </>
  );
}

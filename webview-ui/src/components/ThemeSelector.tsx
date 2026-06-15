import { Check, ChevronDown, Palette } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { THEME_GROUPS, THEME_PREVIEWS } from '../lib/themePreviews';
import { cn } from '../lib/utils';
import type { AppTheme } from '../types';
import { THEME_LABELS } from '../hooks/useTheme';

interface ThemeSelectorProps {
  theme: AppTheme;
  onSelectTheme: (theme: AppTheme) => void;
}

interface MenuPosition {
  top: number;
  left: number;
  minWidth: number;
}

function ThemeSwatch({ themeId, size = 'md' }: { themeId: AppTheme; size?: 'sm' | 'md' }) {
  const preview = THEME_PREVIEWS[themeId];
  const dim = size === 'sm' ? 'w-4 h-4' : 'w-8 h-5';
  return (
    <span
      className={cn('shrink-0 rounded overflow-hidden border border-black/10 flex', dim)}
      aria-hidden
    >
      <span className="flex-1" style={{ background: preview.background }} />
      <span className="w-[35%]" style={{ background: preview.accent }} />
    </span>
  );
}

export function ThemeSelector({ theme, onSelectTheme }: ThemeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activePreview = THEME_PREVIEWS[theme];

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const minWidth = 220;
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

  const menu =
    open && menuPosition
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label="Themes"
            className="fixed z-[9999] rounded border border-border bg-card shadow-lg py-1"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              minWidth: menuPosition.minWidth,
            }}
          >
            {THEME_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </div>
                {group.themes.map((themeId) => {
                  const isActive = themeId === theme;
                  const preview = THEME_PREVIEWS[themeId];
                  return (
                    <button
                      key={themeId}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        onSelectTheme(themeId);
                        setOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-left hover:bg-[var(--as-tree-hover)]',
                        isActive && 'bg-[var(--as-tree-selected)]'
                      )}
                    >
                      <ThemeSwatch themeId={themeId} />
                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="font-medium truncate">{THEME_LABELS[themeId]}</span>
                        <span className="text-[10px] text-muted-foreground">{preview.hint}</span>
                      </span>
                      {isActive && <Check className="w-3.5 h-3.5 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            ))}
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
        className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded border border-border hover:bg-accent shrink-0 max-w-[160px]"
        title={`Theme: ${THEME_LABELS[theme]} (${activePreview.hint})`}
      >
        <Palette className="w-3.5 h-3.5 shrink-0 text-primary" />
        <ThemeSwatch themeId={theme} size="sm" />
        <span className="truncate hidden sm:inline text-muted-foreground">
          {THEME_LABELS[theme]}
        </span>
        <ChevronDown
          className={cn(
            'w-3 h-3 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {menu}
    </>
  );
}

export { ThemeSwatch };

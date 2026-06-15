import { useEffect, useRef } from 'react';
import { cn } from '../lib/utils';

export interface ContextMenuItem {
  id: string;
  label?: string;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  onClick?: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[168px] rounded border border-border bg-card shadow-lg text-xs py-1"
      style={{ left: x, top: y }}
      role="menu"
    >
      {items.map((item) =>
        item.separator ? (
          <div key={item.id} className="my-1 border-t border-border" role="separator" />
        ) : (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={cn(
              'w-full px-2.5 py-1.5 text-left hover:bg-accent disabled:opacity-40 disabled:pointer-events-none',
              item.danger && 'text-danger'
            )}
            onClick={() => {
              if (!item.disabled && item.onClick) {
                item.onClick();
                onClose();
              }
            }}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

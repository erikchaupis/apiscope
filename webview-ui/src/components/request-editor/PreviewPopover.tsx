import { useLayoutEffect, useRef, useState } from 'react';

interface PreviewPopoverProps {
  anchor: HTMLElement;
  value: string;
  onClose: () => void;
}

export function PreviewPopover({ anchor, value, onClose }: PreviewPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect();
      const popover = popoverRef.current;
      const width = popover?.offsetWidth ?? 240;
      const height = popover?.offsetHeight ?? 64;
      const margin = 6;

      let top = rect.bottom + margin;
      if (top + height > window.innerHeight - margin) {
        top = rect.top - height - margin;
      }
      top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));

      let left = rect.right - width;
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));

      setStyle({ top, left, visibility: 'visible' });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [anchor, value]);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div
        ref={popoverRef}
        style={style}
        className="fixed z-50 min-w-[200px] max-w-xs rounded border border-border bg-card px-2.5 py-2 shadow-lg"
      >
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Preview</p>
        <p className="text-xs font-mono break-all text-foreground">{value}</p>
      </div>
    </>
  );
}

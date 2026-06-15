import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_WIDTH = 256;
const MIN_WIDTH = 160;
const MAX_WIDTH = 520;

function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}

export function useHorizontalResize(initialWidth = DEFAULT_WIDTH, onCommit?: (width: number) => void) {
  const [width, setWidth] = useState(() => clampWidth(initialWidth));
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);
  const widthRef = useRef(width);

  useEffect(() => {
    const next = clampWidth(initialWidth);
    setWidth(next);
    widthRef.current = next;
  }, [initialWidth]);

  const onResizeStart = useCallback(
    (clientX: number) => {
      dragging.current = true;
      startX.current = clientX;
      startWidth.current = widthRef.current;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    []
  );

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!dragging.current) {
        return;
      }
      const next = clampWidth(startWidth.current + (event.clientX - startX.current));
      widthRef.current = next;
      setWidth(next);
    };

    const onUp = () => {
      if (!dragging.current) {
        return;
      }
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onCommit?.(widthRef.current);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [onCommit]);

  return { width, onResizeStart, minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH };
}

export { DEFAULT_WIDTH as DEFAULT_COLLECTIONS_PANEL_WIDTH, clampWidth as clampCollectionsPanelWidth };

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RequestResponseLayoutMode } from '../types';

export function useRequestResponseLayout(savedLayout?: RequestResponseLayoutMode) {
  const [layout, setLayout] = useState<RequestResponseLayoutMode>('vertical');
  const userLockedRef = useRef(false);

  useEffect(() => {
    if (savedLayout) {
      userLockedRef.current = true;
      setLayout(savedLayout);
    }
  }, [savedLayout]);

  const toggleLayout = useCallback(() => {
    setLayout((prev) => (prev === 'horizontal' ? 'vertical' : 'horizontal'));
    userLockedRef.current = true;
  }, []);

  const setLayoutExplicit = useCallback((next: RequestResponseLayoutMode) => {
    setLayout(next);
    userLockedRef.current = true;
  }, []);

  return { layout, toggleLayout, setLayoutExplicit };
}

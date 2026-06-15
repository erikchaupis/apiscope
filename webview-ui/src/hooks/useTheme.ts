import { useCallback, useRef, useState } from 'react';
import type { AppTheme } from '../types';

export const THEMES: AppTheme[] = [
  'apiscope',
  'apiscope-light',
  'solar',
  'light',
  'dark',
  'graphite',
];

export const THEME_LABELS: Record<AppTheme, string> = {
  apiscope: 'APIScope',
  'apiscope-light': 'APIScope Light',
  solar: 'Solar',
  light: 'Light',
  dark: 'Dark',
  graphite: 'Graphite',
};

export function useTheme() {
  const [theme, setThemeState] = useState<AppTheme>('apiscope');
  const themeManuallySet = useRef(false);

  const applyTheme = useCallback((t: AppTheme) => {
    document.documentElement.setAttribute('data-theme', t);
    setThemeState(t);
  }, []);

  const setThemeFromHost = useCallback(
    (t: AppTheme | 'high-contrast') => {
      if (!themeManuallySet.current) {
        if (t === 'high-contrast') {
          applyTheme('graphite');
          return;
        }
        if (t === 'light') {
          applyTheme('apiscope-light');
          return;
        }
        if (t === 'dark') {
          applyTheme('apiscope');
          return;
        }
        applyTheme(t);
      }
    },
    [applyTheme]
  );

  const setTheme = useCallback(
    (t: AppTheme) => {
      themeManuallySet.current = true;
      applyTheme(t);
    },
    [applyTheme]
  );

  const cycleTheme = useCallback(() => {
    themeManuallySet.current = true;
    const idx = THEMES.indexOf(theme);
    const next = THEMES[(idx + 1) % THEMES.length];
    applyTheme(next);
  }, [theme, applyTheme]);

  return { theme, setThemeFromHost, setTheme, cycleTheme, themeLabel: THEME_LABELS[theme] };
}

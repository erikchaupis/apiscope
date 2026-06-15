import type { AppTheme } from '../types';

export interface ThemePreview {
  background: string;
  foreground: string;
  accent: string;
  /** Short hint: Dark, Light, or Warm */
  hint: 'Dark' | 'Light' | 'Warm';
}

/** Static swatch colors for theme picker (matches themes.css). */
export const THEME_PREVIEWS: Record<AppTheme, ThemePreview> = {
  apiscope: {
    background: '#0f1419',
    foreground: '#e6edf3',
    accent: '#3b82f6',
    hint: 'Dark',
  },
  'apiscope-light': {
    background: '#ffffff',
    foreground: '#0f1b33',
    accent: '#2563eb',
    hint: 'Light',
  },
  solar: {
    background: '#1a1208',
    foreground: '#fff8e7',
    accent: '#ff9500',
    hint: 'Warm',
  },
  light: {
    background: '#ffffff',
    foreground: '#1f2328',
    accent: '#0550ae',
    hint: 'Light',
  },
  dark: {
    background: '#1e1e1e',
    foreground: '#cccccc',
    accent: '#3794ff',
    hint: 'Dark',
  },
  graphite: {
    background: '#181818',
    foreground: '#e0e0e0',
    accent: '#6cb6ff',
    hint: 'Dark',
  },
};

export const THEME_GROUPS: { label: string; themes: AppTheme[] }[] = [
  { label: 'Brand', themes: ['apiscope', 'apiscope-light', 'solar'] },
  { label: 'Classic', themes: ['light', 'dark', 'graphite'] },
];

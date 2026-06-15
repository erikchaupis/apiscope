import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import json from '@shikijs/langs/json';
import darkPlus from '@shikijs/themes/dark-plus';
import githubDarkHighContrast from '@shikijs/themes/github-dark-high-contrast';
import lightPlus from '@shikijs/themes/light-plus';
import type { AppTheme } from '../types';

type ShikiTheme = 'light-plus' | 'dark-plus' | 'github-dark-high-contrast';

let highlighterPromise: Promise<HighlighterCore> | null = null;

export function themeForAppTheme(theme: AppTheme): ShikiTheme {
  switch (theme) {
    case 'light':
    case 'apiscope-light':
      return 'light-plus';
    case 'dark':
    case 'apiscope':
    case 'solar':
      return 'dark-plus';
    case 'graphite':
      return 'github-dark-high-contrast';
  }
}

export function getShikiHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [lightPlus, darkPlus, githubDarkHighContrast],
      langs: [json],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighterPromise;
}

const transparentBackgroundTransformer = {
  name: 'transparent-background',
  pre(hast: { properties?: { style?: string } }) {
    if (typeof hast.properties?.style === 'string') {
      hast.properties.style = hast.properties.style
        .replace(/background-color:[^;]+;?/gi, '')
        .replace(/(^|;)\s*background:[^;]+;?/gi, '$1')
        .trim();
    }
  },
};

export async function highlightJson(code: string, theme: AppTheme): Promise<string> {
  const highlighter = await getShikiHighlighter();
  return highlighter.codeToHtml(code, {
    lang: 'json',
    theme: themeForAppTheme(theme),
    transformers: [transparentBackgroundTransformer],
  });
}

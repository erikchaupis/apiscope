import * as vscode from 'vscode';
import { HttpMethod } from '../core/types';

const METHOD_COLORS: Record<HttpMethod, { dark: string; light: string }> = {
  GET: { dark: '#4ec9b0', light: '#1a7f37' },
  POST: { dark: '#ce9178', light: '#bc4c00' },
  PUT: { dark: '#3794ff', light: '#0550ae' },
  PATCH: { dark: '#c586c0', light: '#8250df' },
  DELETE: { dark: '#f48771', light: '#cf222e' },
};

const iconCache = new Map<string, { light: vscode.Uri; dark: vscode.Uri }>();

function svgMethodBadge(method: string, color: string): string {
  const text = method.toUpperCase().slice(0, 6);
  const height = 32;
  const fontSize = 15;
  const charWidth = 9;
  const width = Math.round(Math.max(44, text.length * charWidth + 8));
  const baseline = height - 9;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <text x="4" y="${baseline}" font-family="Segoe UI, system-ui, sans-serif" font-size="${fontSize}" font-weight="700" fill="${color}">${text}</text>
</svg>`;
}

function svgUri(svg: string): vscode.Uri {
  return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
}

export function methodTreeIcon(method: HttpMethod | string): { light: vscode.Uri; dark: vscode.Uri } {
  const key = method.toUpperCase();
  const cached = iconCache.get(key);
  if (cached) {
    return cached;
  }
  const colors = METHOD_COLORS[key as HttpMethod] ?? { dark: '#cccccc', light: '#656d76' };
  const icons = {
    light: svgUri(svgMethodBadge(key, colors.light)),
    dark: svgUri(svgMethodBadge(key, colors.dark)),
  };
  iconCache.set(key, icons);
  return icons;
}

export function folderTreeIcon(
  expanded: boolean
): vscode.ThemeIcon {
  return new vscode.ThemeIcon(
    expanded ? 'folder-opened' : 'folder',
    new vscode.ThemeColor('apiScope.folder')
  );
}

export function collectionTreeIcon(generated: boolean): vscode.ThemeIcon {
  return new vscode.ThemeIcon(
    generated ? 'sparkle' : 'library',
    generated ? new vscode.ThemeColor('apiScope.collectionGenerated') : undefined
  );
}

export function sourceTreeIcon(): vscode.ThemeIcon {
  return new vscode.ThemeIcon('code', new vscode.ThemeColor('apiScope.sourceLink'));
}

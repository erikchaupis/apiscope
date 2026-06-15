import type { AppTheme } from '../types';

const TEMPLATE_VAR_RE = /^\{\{(\w+)\}\}/;

type StringPart = { type: 'text'; text: string } | { type: 'var'; name: string };

interface JsonHighlightColors {
  key: string;
  string: string;
  number: string;
  punctuation: string;
  brace: string;
  variable: string;
}

function colorsForTheme(theme: AppTheme): JsonHighlightColors {
  switch (theme) {
    case 'light':
    case 'apiscope-light':
      return {
        key: '#0451A5',
        string: '#A31515',
        number: '#098658',
        punctuation: '#1F2328',
        brace: '#656D76',
        variable: '#BC4C00',
      };
    case 'graphite':
      return {
        key: '#6CB6FF',
        string: '#FF7B72',
        number: '#56D364',
        punctuation: '#E0E0E0',
        brace: '#A0A0A0',
        variable: '#FFA657',
      };
    case 'solar':
      return {
        key: '#5AC8FA',
        string: '#FFD60A',
        number: '#4ADE80',
        punctuation: '#FFF8E7',
        brace: '#C4A574',
        variable: '#FF9500',
      };
    case 'dark':
    case 'apiscope':
    default:
      return {
        key: '#9CDCFE',
        string: '#CE9178',
        number: '#B5CEA8',
        punctuation: '#D4D4D4',
        brace: '#858585',
        variable: '#FFA657',
      };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function variableSpan(name: string, colors: JsonHighlightColors): string {
  return (
    `<span class="json-var-brace" style="color:${colors.brace}">{{</span>` +
    `<span class="json-var-name" style="color:${colors.variable}">${escapeHtml(name)}</span>` +
    `<span class="json-var-brace" style="color:${colors.brace}">}}</span>`
  );
}

function parseQuotedString(raw: string, start: number): { parts: StringPart[]; end: number } {
  const parts: StringPart[] = [];
  let i = start + 1;
  let text = '';

  const flushText = () => {
    if (text) {
      parts.push({ type: 'text', text });
      text = '';
    }
  };

  while (i < raw.length) {
    const varMatch = raw.slice(i).match(TEMPLATE_VAR_RE);
    if (varMatch) {
      flushText();
      parts.push({ type: 'var', name: varMatch[1] });
      i += varMatch[0].length;
      continue;
    }

    const char = raw[i];
    if (char === '\\' && i + 1 < raw.length) {
      text += char + raw[i + 1];
      i += 2;
      continue;
    }
    if (char === '"') {
      flushText();
      i++;
      break;
    }
    text += char;
    i++;
  }

  return { parts, end: i };
}

function renderQuotedString(
  parts: StringPart[],
  colors: JsonHighlightColors,
  kind: 'key' | 'value'
): string {
  const quoteColor = kind === 'key' ? colors.key : colors.string;
  const textColor = kind === 'key' ? colors.key : colors.string;
  let inner = '';

  for (const part of parts) {
    if (part.type === 'var') {
      inner += variableSpan(part.name, colors);
    } else {
      inner += `<span style="color:${textColor}">${escapeHtml(part.text)}</span>`;
    }
  }

  return (
    `<span style="color:${quoteColor}">"</span>${inner}<span style="color:${quoteColor}">"</span>`
  );
}

function isKeyAt(raw: string, endQuoteIndex: number): boolean {
  let j = endQuoteIndex;
  while (j < raw.length && (raw[j] === ' ' || raw[j] === '\t')) {
    j++;
  }
  return raw[j] === ':';
}

/** Highlight JSON request bodies on the original text, with distinct `{{variable}}` styling. */
export function highlightJsonBodyWithVariables(raw: string, theme: AppTheme): string {
  if (!raw) {
    return '';
  }

  const colors = colorsForTheme(theme);
  let html = '';
  let i = 0;

  while (i < raw.length) {
    const rest = raw.slice(i);

    const varMatch = rest.match(TEMPLATE_VAR_RE);
    if (varMatch) {
      html += variableSpan(varMatch[1], colors);
      i += varMatch[0].length;
      continue;
    }

    const wsMatch = rest.match(/^[\r\n\t ]+/);
    if (wsMatch) {
      html += escapeHtml(wsMatch[0]);
      i += wsMatch[0].length;
      continue;
    }

    if (raw[i] === '"') {
      const parsed = parseQuotedString(raw, i);
      const kind = isKeyAt(raw, parsed.end) ? 'key' : 'value';
      html += renderQuotedString(parsed.parts, colors, kind);
      i = parsed.end;
      continue;
    }

    const numMatch = rest.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (numMatch) {
      html += `<span style="color:${colors.number}">${escapeHtml(numMatch[0])}</span>`;
      i += numMatch[0].length;
      continue;
    }

    if ('{}[],:'.includes(raw[i])) {
      html += `<span style="color:${colors.punctuation}">${escapeHtml(raw[i])}</span>`;
      i++;
      continue;
    }

    if (rest.startsWith('true') || rest.startsWith('false') || rest.startsWith('null')) {
      const keyword = rest.startsWith('true')
        ? 'true'
        : rest.startsWith('false')
          ? 'false'
          : 'null';
      html += `<span style="color:${colors.number}">${keyword}</span>`;
      i += keyword.length;
      continue;
    }

    html += escapeHtml(raw[i]);
    i++;
  }

  return html;
}

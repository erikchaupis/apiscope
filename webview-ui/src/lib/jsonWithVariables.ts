const TEMPLATE_VAR_RE = /^\{\{(\w+)\}\}/;

export interface JsonWithVariablesResult {
  ok: boolean;
  value?: unknown;
}

/** Replace unquoted `{{name}}` tokens so JSON.parse can succeed. Quoted placeholders are left as-is. */
export function substituteJsonTemplateVariables(
  raw: string,
  options: { sameLength?: boolean } = {}
): string {
  const { sameLength = false } = options;
  let result = '';
  let i = 0;
  let inString = false;

  while (i < raw.length) {
    const char = raw[i];

    if (inString) {
      if (char === '\\' && i + 1 < raw.length) {
        result += char + raw[i + 1];
        i += 2;
        continue;
      }
      if (char === '"') {
        inString = false;
        result += char;
        i++;
        continue;
      }
      result += char;
      i++;
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      i++;
      continue;
    }

    const varMatch = raw.slice(i).match(TEMPLATE_VAR_RE);
    if (varMatch) {
      const token = varMatch[0];
      if (sameLength) {
        // JSON numbers cannot have leading zeros (except "0" alone). Repeat a non-zero digit.
        result += '1'.repeat(token.length);
      } else {
        result += '0';
      }
      i += token.length;
      continue;
    }

    result += char;
    i++;
  }

  return result;
}

export function tryParseJsonWithVariables(raw: string): JsonWithVariablesResult {
  const trimmed = raw.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return { ok: false };
  }
  try {
    const substituted = substituteJsonTemplateVariables(trimmed);
    return { ok: true, value: JSON.parse(substituted) };
  } catch {
    return { ok: false };
  }
}

export function isValidJsonWithVariables(raw: string): boolean {
  return tryParseJsonWithVariables(raw).ok;
}

export function tryFormatJsonWithVariables(raw: string): { formatted: string; isJson: boolean } {
  const parsed = tryParseJsonWithVariables(raw);
  if (!parsed.ok || parsed.value === undefined) {
    return { formatted: raw, isJson: false };
  }
  return {
    formatted: JSON.stringify(parsed.value, null, 2),
    isJson: true,
  };
}

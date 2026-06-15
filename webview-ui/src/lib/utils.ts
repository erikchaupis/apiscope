import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { preRequestVariableNames, previewPreRequestVariables } from './preRequestVariables';
import { postRequestVariableNames, previewPostRequestVariables } from './postRequestVariables';
import { scriptSetVariableNames } from './scriptVariableExtraction';
import type { ApiRequest, ApiResponse, EnvironmentVariable, WorkspaceTabType } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function methodClass(method: string): string {
  return `method-${method.toLowerCase()}`;
}

export function tabTypeLabel(type: WorkspaceTabType): string {
  switch (type) {
    case 'request':
      return 'Request';
    case 'history':
      return 'History';
    case 'draft':
      return 'Draft';
    case 'environment':
      return 'Environment';
    case 'login':
      return 'Global Authentication';
    case 'scan':
      return 'Scan';
  }
}

export function tabTypeTagClass(type: WorkspaceTabType): string {
  switch (type) {
    case 'request':
      return 'tab-tag-request';
    case 'history':
      return 'tab-tag-history';
    case 'draft':
      return 'tab-tag-draft';
    case 'environment':
      return 'tab-tag-environment';
    case 'login':
      return 'tab-tag-login';
    case 'scan':
      return 'tab-tag-scan';
  }
}

export function tryFormatJson(raw: string): { formatted: string; isJson: boolean } {
  const trimmed = raw.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return { formatted: raw, isJson: false };
  }
  try {
    return {
      formatted: JSON.stringify(JSON.parse(trimmed), null, 2),
      isJson: true,
    };
  } catch {
    return { formatted: raw, isJson: false };
  }
}

export function formatJson(raw: string): string {
  return tryFormatJson(raw).formatted;
}

const ENV_VAR_RE = /\{\{(\w+)\}\}/g;

export function hasTemplateVariables(template: string): boolean {
  return ENV_VAR_RE.test(template);
}

export function resolveTemplate(
  template: string,
  variables: EnvironmentVariable[]
): string {
  return template.replace(ENV_VAR_RE, (_, name: string) => {
    const variable = variables.find((v) => v.name === name);
    return variable?.value ?? `{{${name}}}`;
  });
}

export function variableSuggestionNames(variables: EnvironmentVariable[]): string[] {
  return [...new Set(variables.map((variable) => variable.name.trim()).filter(Boolean))].sort();
}

export function mergeVariableScopes(
  ...scopes: EnvironmentVariable[][]
): EnvironmentVariable[] {
  const merged = new Map<string, string>();
  for (const scope of scopes) {
    for (const variable of scope) {
      const name = variable.name.trim();
      if (name) {
        merged.set(name, variable.value);
      }
    }
  }
  return [...merged.entries()].map(([name, value]) => ({ name, value }));
}

/** Resolution order: Environment (lowest) → Runtime → Request (highest). */
export function buildResolutionScope(
  environmentVariables: EnvironmentVariable[],
  runtimeVariables: EnvironmentVariable[],
  requestVariables: EnvironmentVariable[]
): EnvironmentVariable[] {
  return mergeVariableScopes(environmentVariables, runtimeVariables, requestVariables);
}

export function buildRequestVariableScope(
  request: ApiRequest,
  environmentVariables: EnvironmentVariable[],
  runtimeVariables: EnvironmentVariable[] = []
): EnvironmentVariable[] {
  const requestVariables = mergeVariableScopes(
    preRequestVariableNames(request.automation?.preRequestVariables),
    postRequestVariableNames(request.automation?.postRequestVariables),
    scriptSetVariableNames(request.automation?.preRequest)
  );
  return buildResolutionScope(environmentVariables, runtimeVariables, requestVariables);
}

export function buildPreviewVariableScope(
  request: ApiRequest,
  environmentVariables: EnvironmentVariable[],
  response?: ApiResponse | null,
  runtimeVariables: EnvironmentVariable[] = []
): EnvironmentVariable[] {
  const requestVariables = mergeVariableScopes(
    previewPreRequestVariables(request.automation?.preRequestVariables),
    previewPostRequestVariables(request.automation?.postRequestVariables, response),
    scriptSetVariableNames(request.automation?.preRequest)
  );
  return buildResolutionScope(environmentVariables, runtimeVariables, requestVariables);
}

export function findMissingVariablesInText(
  text: string,
  variables: EnvironmentVariable[]
): string[] {
  const names = new Set(variables.map((v) => v.name));
  const missing = new Set<string>();
  for (const match of text.matchAll(ENV_VAR_RE)) {
    if (!names.has(match[1])) {
      missing.add(match[1]);
    }
  }
  return [...missing];
}

export function findMissingVariablesInRequest(
  request: ApiRequest,
  variables: EnvironmentVariable[]
): string[] {
  const missing = new Set<string>();
  for (const name of findMissingVariablesInText(request.url, variables)) {
    missing.add(name);
  }
  for (const h of request.headers) {
    for (const name of findMissingVariablesInText(h.key, variables)) {
      missing.add(name);
    }
    for (const name of findMissingVariablesInText(h.value, variables)) {
      missing.add(name);
    }
  }
  for (const q of request.queryParams) {
    for (const name of findMissingVariablesInText(q.key, variables)) {
      missing.add(name);
    }
    for (const name of findMissingVariablesInText(q.value, variables)) {
      missing.add(name);
    }
  }
  if (request.body) {
    for (const name of findMissingVariablesInText(request.body, variables)) {
      missing.add(name);
    }
  }
  if (request.requestBody?.content) {
    for (const name of findMissingVariablesInText(request.requestBody.content, variables)) {
      missing.add(name);
    }
  }
  for (const row of request.requestBody?.urlEncoded ?? []) {
    for (const name of findMissingVariablesInText(row.key, variables)) {
      missing.add(name);
    }
    for (const name of findMissingVariablesInText(row.value, variables)) {
      missing.add(name);
    }
  }
  for (const field of request.requestBody?.formData ?? []) {
    for (const name of findMissingVariablesInText(field.key, variables)) {
      missing.add(name);
    }
    if (field.type === 'text') {
      for (const name of findMissingVariablesInText(field.value, variables)) {
        missing.add(name);
      }
    }
  }
  const auth = request.authorization;
  if (auth) {
    for (const text of [
      auth.bearerToken,
      auth.bearerPrefix,
      auth.basicUsername,
      auth.basicPassword,
      auth.apiKeyName,
      auth.apiKeyValue,
    ]) {
      if (text) {
        for (const name of findMissingVariablesInText(text, variables)) {
          missing.add(name);
        }
      }
    }
  }
  return [...missing];
}

/** Spring-style path variables like {id}, not environment templates like {{baseUrl}} */
const PATH_VARIABLE_RE = /(?<!\{)\{(\w+)\}(?!\})/;

export function findFirstPathVariable(url: string): RegExpMatchArray | null {
  return PATH_VARIABLE_RE.exec(url);
}

export function replaceFirstPathVariable(url: string, value: string): string {
  return url.replace(PATH_VARIABLE_RE, value);
}

export function findPathVariableFocus(url: string): {
  url: string;
  selectionStart: number;
  selectionEnd: number;
} | null {
  const match = findFirstPathVariable(url);
  if (!match || match.index === undefined) {
    return null;
  }
  const placeholder = '1';
  const nextUrl = replaceFirstPathVariable(url, placeholder);
  const start = nextUrl.indexOf(placeholder, match.index);
  if (start < 0) {
    return null;
  }
  return { url: nextUrl, selectionStart: start, selectionEnd: start + placeholder.length };
}

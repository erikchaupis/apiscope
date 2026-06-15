import { ApiRequest, EnvironmentVariable } from './types';
import { collectRequestBodyText } from './requestBody';

const ENV_VAR_RE = /\{\{(\w+)\}\}/g;

export function getVariableNames(variables: EnvironmentVariable[]): Set<string> {
  return new Set(variables.map((v) => v.name).filter(Boolean));
}

export function findMissingVariablesInText(
  text: string,
  variables: EnvironmentVariable[]
): string[] {
  const names = getVariableNames(variables);
  const missing = new Set<string>();
  for (const match of text.matchAll(ENV_VAR_RE)) {
    if (!names.has(match[1])) {
      missing.add(match[1]);
    }
  }
  return [...missing];
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
  for (const text of collectRequestBodyText(request)) {
    for (const name of findMissingVariablesInText(text, variables)) {
      missing.add(name);
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

export function resolveTemplate(
  template: string,
  variables: EnvironmentVariable[]
): string {
  return template.replace(ENV_VAR_RE, (_, name: string) => {
    const variable = variables.find((v) => v.name === name);
    return variable?.value ?? '';
  });
}

export function resolveTemplatePreview(
  template: string,
  variables: EnvironmentVariable[]
): string {
  return template.replace(ENV_VAR_RE, (_, name: string) => {
    const variable = variables.find((v) => v.name === name);
    return variable?.value ?? `{{${name}}}`;
  });
}

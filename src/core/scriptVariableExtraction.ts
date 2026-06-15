import { EnvironmentVariable } from './types';

const ENV_SET_RE = /env\.set\s*\(\s*["']([^"']+)["']/g;

/** Names assigned via env.set("name", ...) in a request script. */
export function extractScriptSetVariableNames(script: string | undefined): string[] {
  if (!script?.trim()) {
    return [];
  }
  const names = new Set<string>();
  for (const match of script.matchAll(ENV_SET_RE)) {
    const name = match[1]?.trim();
    if (name) {
      names.add(name);
    }
  }
  return [...names];
}

export function scriptSetVariableNames(script: string | undefined): EnvironmentVariable[] {
  return extractScriptSetVariableNames(script).map((name) => ({ name, value: '' }));
}

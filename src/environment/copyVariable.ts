import { EnvironmentVariable } from '../core/types';

export function buildCopiedVariable(variable: EnvironmentVariable): EnvironmentVariable | undefined {
  const name = variable.name.trim();
  if (!name) {
    return undefined;
  }
  const copy: EnvironmentVariable = { name, value: variable.value };
  if (variable.sensitive) {
    copy.sensitive = true;
  }
  return copy;
}

export function applyVariableCopy(
  variables: EnvironmentVariable[],
  variable: EnvironmentVariable,
  overwrite: boolean
): { variables: EnvironmentVariable[]; changed: boolean } {
  const copy = buildCopiedVariable(variable);
  if (!copy) {
    return { variables, changed: false };
  }

  const idx = variables.findIndex((v) => v.name === copy.name);
  if (idx < 0) {
    return { variables: [...variables, copy], changed: true };
  }
  if (!overwrite) {
    return { variables, changed: false };
  }
  const next = [...variables];
  next[idx] = copy;
  const changed =
    next[idx].value !== variables[idx].value ||
    Boolean(next[idx].sensitive) !== Boolean(variables[idx].sensitive);
  return { variables: next, changed };
}

import { EnvironmentVariable } from '../core/types';

/** In-memory runtime variables — never persisted to disk. */
export class RuntimeVariableStore {
  private readonly vars = new Map<string, string>();

  get(name: string): string | undefined {
    const value = this.vars.get(name.trim());
    return value === undefined ? undefined : value;
  }

  set(name: string, value: unknown): void {
    const key = name.trim();
    if (!key) {
      return;
    }
    if (value === undefined || value === null) {
      this.vars.delete(key);
      return;
    }
    this.vars.set(key, String(value));
  }

  setMany(variables: EnvironmentVariable[]): void {
    for (const { name, value } of variables) {
      this.set(name, value);
    }
  }

  unset(name: string): void {
    const key = name.trim();
    if (key) {
      this.vars.delete(key);
    }
  }

  clear(): void {
    this.vars.clear();
  }

  toVariables(): EnvironmentVariable[] {
    return [...this.vars.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

let sharedStore: RuntimeVariableStore | undefined;

export function getRuntimeVariableStore(): RuntimeVariableStore {
  if (!sharedStore) {
    sharedStore = new RuntimeVariableStore();
  }
  return sharedStore;
}

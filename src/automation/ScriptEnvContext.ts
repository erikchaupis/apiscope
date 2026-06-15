import { EnvironmentVariable } from '../core/types';
import { RuntimeVariableStore } from '../runtime/RuntimeVariableStore';

function variableMap(variables: EnvironmentVariable[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const variable of variables) {
    const name = variable.name.trim();
    if (name) {
      map.set(name, variable.value);
    }
  }
  return map;
}

/** Script env API: get resolves Request → Runtime → Environment; set/unset/clear affect runtime only. */
export class ScriptEnvContext {
  private readonly requestVars: Map<string, string>;
  private readonly environmentVars: Map<string, string>;

  constructor(
    requestVariables: EnvironmentVariable[],
    environmentVariables: EnvironmentVariable[],
    private readonly runtimeStore: RuntimeVariableStore
  ) {
    this.requestVars = variableMap(requestVariables);
    this.environmentVars = variableMap(environmentVariables);
  }

  get(name: string): string | undefined {
    const key = name.trim();
    if (!key) {
      return undefined;
    }
    if (this.requestVars.has(key)) {
      return this.requestVars.get(key);
    }
    const runtime = this.runtimeStore.get(key);
    if (runtime !== undefined) {
      return runtime;
    }
    return this.environmentVars.get(key);
  }

  set(name: string, value: unknown): void {
    this.runtimeStore.set(name, value);
  }

  unset(name: string): void {
    this.runtimeStore.unset(name);
  }

  clear(): void {
    this.runtimeStore.clear();
  }

  getRuntimeVariables(): EnvironmentVariable[] {
    return this.runtimeStore.toVariables();
  }
}

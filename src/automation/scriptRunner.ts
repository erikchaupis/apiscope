import * as vm from 'vm';
import { ApiRequest, ApiResponse, EnvironmentVariable } from '../core/types';
import { ScriptEnvContext } from './ScriptEnvContext';
import { RuntimeVariableStore } from '../runtime/RuntimeVariableStore';
import { injectLoopGuards, validateScriptSource } from './scriptTransform';

const SCRIPT_TIMEOUT_MS = 500;
const MAX_LOOP_ITERATIONS = 10_000;
const LIMIT_ERROR = 'Script execution limit exceeded.';

export interface ScriptRunResult {
  success: boolean;
  error?: string;
  consoleLogs: string[];
  variables: EnvironmentVariable[];
}

export interface TestScriptRunResult extends ScriptRunResult {
  assertionFailure?: {
    expected?: string;
    actual?: string;
    conditionFailed?: boolean;
  };
}

const ASSERT_PREFIX = '__API_SCOPE_ASSERT__:';

function createAssert(): (actual: unknown, expected?: unknown) => void {
  return function assert(actual: unknown, expected?: unknown) {
    if (arguments.length < 2) {
      if (!actual) {
        throw new Error(`${ASSERT_PREFIX}${JSON.stringify({ conditionFailed: true })}`);
      }
      return;
    }
    if (actual != expected) {
      throw new Error(
        `${ASSERT_PREFIX}${JSON.stringify({
          expected: valueToAssertString(expected),
          actual: valueToAssertString(actual),
        })}`
      );
    }
  };
}

function parseAssertFailure(message: string):
  | {
      expected?: string;
      actual?: string;
      conditionFailed?: boolean;
    }
  | undefined {
  if (!message.startsWith(ASSERT_PREFIX)) {
    return undefined;
  }
  try {
    return JSON.parse(message.slice(ASSERT_PREFIX.length)) as {
      expected?: string;
      actual?: string;
      conditionFailed?: boolean;
    };
  } catch {
    return undefined;
  }
}

function valueToAssertString(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function headersToObject(headers: Array<{ key: string; value: string; enabled: boolean }>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const header of headers) {
    if (header.enabled && header.key) {
      result[header.key] = header.value;
    }
  }
  return result;
}

function responseHeadersToObject(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key.toLowerCase()] = value;
  }
  return result;
}

function buildRequestBody(request: ApiRequest): string | undefined {
  if (request.requestBody?.content !== undefined) {
    return request.requestBody.content;
  }
  return request.body;
}

function runScript(
  script: string,
  envContext: ScriptEnvContext,
  sandboxExtras: Record<string, unknown>,
  options?: { includeAssert?: boolean }
): ScriptRunResult | TestScriptRunResult {
  const trimmed = script.trim();
  const runtimeVariables = () => envContext.getRuntimeVariables();

  if (!trimmed) {
    return {
      success: true,
      consoleLogs: [],
      variables: runtimeVariables(),
    };
  }

  const validationError = validateScriptSource(trimmed);
  if (validationError) {
    return {
      success: false,
      error: validationError,
      consoleLogs: [],
      variables: runtimeVariables(),
    };
  }

  const consoleLogs: string[] = [];
  let loopCount = 0;

  const sandbox: Record<string, unknown> = {
    env: {
      get: (name: string) => envContext.get(name),
      set: (name: string, value: unknown) => envContext.set(name, value),
      unset: (name: string) => envContext.unset(name),
      clear: () => envContext.clear(),
    },
    console: {
      log: (...args: unknown[]) => {
        consoleLogs.push(args.map((arg) => String(arg)).join(' '));
      },
    },
    ...(options?.includeAssert ? { assert: createAssert() } : {}),
    Array,
    Object,
    String,
    Number,
    Boolean,
    Math,
    Date,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    undefined,
    NaN,
    Infinity,
    __loopGuard: () => {
      loopCount++;
      if (loopCount > MAX_LOOP_ITERATIONS) {
        throw new Error(LIMIT_ERROR);
      }
    },
    ...sandboxExtras,
  };

  const context = vm.createContext(sandbox, {
    codeGeneration: { strings: false, wasm: false },
  });

  const wrapped = `"use strict";\n${injectLoopGuards(trimmed)}`;

  try {
    vm.runInContext(wrapped, context, {
      timeout: SCRIPT_TIMEOUT_MS,
      displayErrors: true,
    });
    return {
      success: true,
      consoleLogs,
      variables: runtimeVariables(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const assertionFailure = parseAssertFailure(message);
    if (assertionFailure) {
      return {
        success: false,
        error: assertionFailure.conditionFailed
          ? 'Condition returned false'
          : 'Assertion failed',
        consoleLogs,
        variables: runtimeVariables(),
        assertionFailure,
      };
    }
    const normalized =
      message.includes('Script execution timed out') ||
      message === LIMIT_ERROR ||
      message.includes('execution limit')
        ? LIMIT_ERROR
        : message;
    return {
      success: false,
      error: normalized,
      consoleLogs,
      variables: runtimeVariables(),
    };
  }
}

function createEnvContext(
  requestVariables: EnvironmentVariable[],
  environmentVariables: EnvironmentVariable[],
  runtimeStore: RuntimeVariableStore
): ScriptEnvContext {
  return new ScriptEnvContext(requestVariables, environmentVariables, runtimeStore);
}

export function runPreRequestScript(
  script: string,
  requestVariables: EnvironmentVariable[],
  environmentVariables: EnvironmentVariable[],
  runtimeStore: RuntimeVariableStore,
  request: ApiRequest
): ScriptRunResult {
  const envContext = createEnvContext(requestVariables, environmentVariables, runtimeStore);
  return runScript(script, envContext, {
    request: {
      url: request.url,
      method: request.method,
      headers: headersToObject(request.headers),
      body: buildRequestBody(request),
    },
  });
}

export function runPostRequestScript(
  script: string,
  requestVariables: EnvironmentVariable[],
  environmentVariables: EnvironmentVariable[],
  runtimeStore: RuntimeVariableStore,
  response: ApiResponse
): ScriptRunResult {
  const envContext = createEnvContext(requestVariables, environmentVariables, runtimeStore);
  const headerMap = responseHeadersToObject(response.headers);
  let parsedJson: unknown | undefined;
  return runScript(script, envContext, {
    response: buildResponseSandbox(response, headerMap, () => parsedJson, (value) => {
      parsedJson = value;
    }),
  }) as ScriptRunResult;
}

function buildResponseSandbox(
  response: ApiResponse,
  headerMap: Record<string, string>,
  getParsedJson: () => unknown | undefined,
  setParsedJson: (value: unknown) => void
) {
  return {
    status: response.statusCode,
    headers: headerMap,
    text: () => response.body,
    json: () => {
      const cached = getParsedJson();
      if (cached !== undefined) {
        return cached;
      }
      const parsed = JSON.parse(response.body);
      setParsedJson(parsed);
      return parsed;
    },
  };
}

export function runTestScript(
  script: string,
  requestVariables: EnvironmentVariable[],
  environmentVariables: EnvironmentVariable[],
  runtimeStore: RuntimeVariableStore,
  response: ApiResponse
): TestScriptRunResult {
  const envContext = createEnvContext(requestVariables, environmentVariables, runtimeStore);
  const headerMap = responseHeadersToObject(response.headers);
  let parsedJson: unknown | undefined;
  return runScript(
    script,
    envContext,
    {
      response: buildResponseSandbox(response, headerMap, () => parsedJson, (value) => {
        parsedJson = value;
      }),
    },
    { includeAssert: true }
  ) as TestScriptRunResult;
}

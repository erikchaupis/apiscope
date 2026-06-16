import {
  ApiRequest,
  DEFAULT_ENVIRONMENT_TIER,
  Environment,
  EnvironmentTier,
  EnvironmentVariable,
  GENERATED_ENVIRONMENT_ID,
  GENERATED_ENVIRONMENT_NAME,
} from '../core/types';
import { normalizeRequestBody } from '../core/requestBody';
import {
  buildResolutionScope,
  findMissingVariablesInRequest,
  mergeVariableScopes,
  resolveTemplate,
} from '../core/variableResolution';
import {
  generatePreRequestVariables,
  preRequestVariableNames,
} from '../core/preRequestVariables';
import {
  extractPostRequestVariables,
  postRequestVariableNames,
} from '../core/postRequestVariables';
import { scriptSetVariableNames } from '../core/scriptVariableExtraction';
import { ApiResponse, EnvironmentVariable } from '../core/types';
import { applyVariableCopy } from './copyVariable';
import { detectBaseUrlForProject } from '../scanner/detectBaseUrl';
import {
  apiscopeExists,
  deleteEnvironmentFile,
  loadAllEnvironments,
  loadConfig,
  loadEnvironment,
  nextEnvironmentId,
  persistEnvironment,
  renameEnvironmentMetadata,
  saveConfig,
  saveEnvironment,
} from '../storage/ApiScopeStorage';

export class EnvironmentManager {
  private cachedEnvironments: Environment[] | null = null;
  private cachedActiveId: string | null = null;

  async getEnvironments(workspaceRoot: string): Promise<Environment[]> {
    const stored = loadAllEnvironments(workspaceRoot);
    if (stored.length) {
      this.cachedEnvironments = stored;
      return stored;
    }
    const env = await this.buildGeneratedEnvironment(workspaceRoot);
    if (apiscopeExists(workspaceRoot)) {
      saveEnvironment(workspaceRoot, env);
    }
    this.cachedEnvironments = [env];
    return [env];
  }

  getCachedEnvironments(): Environment[] | null {
    return this.cachedEnvironments;
  }

  async getActiveEnvironmentId(workspaceRoot: string): Promise<string> {
    const config = loadConfig(workspaceRoot);
    this.cachedActiveId = config.activeEnvironmentId;
    return config.activeEnvironmentId;
  }

  getCachedActiveEnvironmentId(): string | null {
    return this.cachedActiveId;
  }

  async setActiveEnvironmentId(workspaceRoot: string, id: string): Promise<void> {
    this.cachedActiveId = id;
    const config = loadConfig(workspaceRoot);
    saveConfig(workspaceRoot, { ...config, activeEnvironmentId: id });
  }

  async updateEnvironmentVariable(
    workspaceRoot: string,
    envId: string,
    name: string,
    value: string
  ): Promise<Environment[]> {
    const envs = await this.getEnvironments(workspaceRoot);
    const updated = envs.map((env) => {
      if (env.id !== envId) {
        return env;
      }
      const vars = [...env.variables];
      const idx = vars.findIndex((v) => v.name === name);
      if (idx >= 0) {
        vars[idx] = { ...vars[idx], name, value };
      } else if (name.trim()) {
        vars.push({ name: name.trim(), value });
      }
      const next = { ...env, variables: vars };
      saveEnvironment(workspaceRoot, next);
      return next;
    });
    this.cachedEnvironments = updated;
    return updated;
  }

  async setEnvironmentVariables(
    workspaceRoot: string,
    envId: string,
    variables: EnvironmentVariable[]
  ): Promise<Environment[]> {
    const cleaned = variables.filter((v) => v.name.trim());
    const envs = await this.getEnvironments(workspaceRoot);
    const updated = envs.map((env) => {
      if (env.id !== envId) {
        return env;
      }
      const next = { ...env, variables: cleaned };
      saveEnvironment(workspaceRoot, next);
      return next;
    });
    this.cachedEnvironments = updated;
    return updated;
  }

  async copyVariableToEnvironments(
    workspaceRoot: string,
    sourceEnvId: string,
    variable: EnvironmentVariable,
    targetEnvIds: string[],
    overwrite: boolean
  ): Promise<{ environments: Environment[]; copiedCount: number }> {
    const envs = await this.getEnvironments(workspaceRoot);
    const uniqueTargets = [...new Set(targetEnvIds.filter((id) => id !== sourceEnvId))];
    let copiedCount = 0;
    const updated = envs.map((env) => {
      if (!uniqueTargets.includes(env.id)) {
        return env;
      }
      const result = applyVariableCopy(env.variables, variable, overwrite);
      if (!result.changed) {
        return env;
      }
      copiedCount++;
      const next = { ...env, variables: result.variables };
      saveEnvironment(workspaceRoot, next);
      return next;
    });
    this.cachedEnvironments = updated;
    return { environments: updated, copiedCount };
  }

  async refreshGeneratedEnvironment(workspaceRoot: string): Promise<Environment[]> {
    const baseUrl = await detectBaseUrlForProject(workspaceRoot);
    const envs = await this.getEnvironments(workspaceRoot);
    const generated = envs.find((e) => e.id === GENERATED_ENVIRONMENT_ID);
    if (!generated) {
      const created = await this.buildGeneratedEnvironment(workspaceRoot);
      const withUrl = {
        ...created,
        variables: [{ name: 'baseUrl', value: baseUrl }],
      };
      if (apiscopeExists(workspaceRoot)) {
        saveEnvironment(workspaceRoot, withUrl);
      }
      this.cachedEnvironments = [
        withUrl,
        ...envs.filter((e) => e.id !== GENERATED_ENVIRONMENT_ID),
      ];
      return this.cachedEnvironments;
    }

    const vars = [...generated.variables];
    const idx = vars.findIndex((v) => v.name === 'baseUrl');
    if (idx >= 0) {
      vars[idx] = { ...vars[idx], value: baseUrl };
    } else {
      vars.unshift({ name: 'baseUrl', value: baseUrl });
    }
    const next = { ...generated, variables: vars };
    if (apiscopeExists(workspaceRoot)) {
      saveEnvironment(workspaceRoot, next);
    }
    const updated = envs.map((env) => (env.id === GENERATED_ENVIRONMENT_ID ? next : env));
    this.cachedEnvironments = updated;
    return updated;
  }

  async createEnvironment(
    workspaceRoot: string,
    name: string,
    environmentType: EnvironmentTier = DEFAULT_ENVIRONMENT_TIER
  ): Promise<Environment[]> {
    const envs = await this.getEnvironments(workspaceRoot);
    const generated = envs.find((e) => e.id === GENERATED_ENVIRONMENT_ID);
    const baseUrl =
      generated?.variables.find((v) => v.name === 'baseUrl')?.value ??
      (await detectBaseUrlForProject(workspaceRoot));
    const env: Environment = {
      id: nextEnvironmentId(workspaceRoot),
      name: name.trim(),
      source: 'user',
      environmentType,
      variables: [{ name: 'baseUrl', value: baseUrl }],
    };
    saveEnvironment(workspaceRoot, env);
    const updated = [...envs, env].sort((a, b) => {
      if (a.source === 'generated') {
        return -1;
      }
      if (b.source === 'generated') {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
    this.cachedEnvironments = updated;
    return updated;
  }

  async duplicateEnvironment(
    workspaceRoot: string,
    sourceId: string
  ): Promise<{ environments: Environment[]; copy: Environment }> {
    const envs = await this.getEnvironments(workspaceRoot);
    const source = envs.find((e) => e.id === sourceId);
    if (!source) {
      throw new Error('Environment not found.');
    }

    let name = source.name;
    if (source.source === 'generated') {
      name = 'DEV';
    } else {
      name = `${source.name} Copy`;
    }
    let n = 2;
    while (envs.some((e) => e.name === name)) {
      name = source.source === 'generated' ? `DEV ${n}` : `${source.name} Copy ${n}`;
      n++;
    }

    const copy: Environment = {
      id: nextEnvironmentId(workspaceRoot),
      name,
      source: 'user',
      environmentType: source.source === 'generated' ? 'DEV' : source.environmentType,
      variables: source.variables.map((v) => ({ ...v })),
    };
    saveEnvironment(workspaceRoot, copy);
    const updated = [...envs, copy];
    this.cachedEnvironments = updated;
    return { environments: updated, copy };
  }

  async renameEnvironment(
    workspaceRoot: string,
    envId: string,
    name: string
  ): Promise<Environment[]> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Environment name cannot be empty.');
    }
    const env = loadEnvironment(workspaceRoot, envId);
    if (!env || env.source === 'generated') {
      throw new Error('The generated environment cannot be renamed.');
    }
    renameEnvironmentMetadata(workspaceRoot, envId, trimmed);
    const envs = await this.getEnvironments(workspaceRoot);
    const updated = envs.map((e) => (e.id === envId ? { ...e, name: trimmed } : e));
    this.cachedEnvironments = updated;
    return updated;
  }

  async deleteEnvironment(workspaceRoot: string, envId: string): Promise<Environment[]> {
    const envs = await this.getEnvironments(workspaceRoot);
    if (envs.length <= 1) {
      throw new Error('At least one environment is required.');
    }
    if (envId === GENERATED_ENVIRONMENT_ID) {
      throw new Error('The generated environment cannot be deleted.');
    }
    deleteEnvironmentFile(workspaceRoot, envId);
    const updated = envs.filter((e) => e.id !== envId);
    this.cachedEnvironments = updated;

    const config = loadConfig(workspaceRoot);
    if (config.activeEnvironmentId === envId) {
      await this.setActiveEnvironmentId(workspaceRoot, GENERATED_ENVIRONMENT_ID);
    }
    return updated;
  }

  findMissingVariables(request: ApiRequest, variables: EnvironmentVariable[]): string[] {
    return findMissingVariablesInRequest(request, variables);
  }

  resolveUrl(template: string, env: Environment): string {
    return resolveTemplate(template, env.variables);
  }

  buildRequestVariableScope(
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

  buildRequestExecutionScope(
    request: ApiRequest,
    lastResponse?: ApiResponse | null
  ): EnvironmentVariable[] {
    return mergeVariableScopes(
      generatePreRequestVariables(request.automation?.preRequestVariables),
      extractPostRequestVariables(request.automation?.postRequestVariables, lastResponse ?? null)
    );
  }

  /** @deprecated Use buildRequestExecutionScope with buildResolutionScope for full scope. */
  buildExecutionVariableScope(
    request: ApiRequest,
    environmentVariables: EnvironmentVariable[],
    lastResponse?: ApiResponse | null
  ): EnvironmentVariable[] {
    return mergeVariableScopes(
      environmentVariables,
      this.buildRequestExecutionScope(request, lastResponse)
    );
  }

  resolveRequest(request: ApiRequest, variables: EnvironmentVariable[]): ApiRequest {
    const resolve = (value: string) => resolveTemplate(value, variables);
    const authorization = request.authorization
      ? {
          ...request.authorization,
          bearerToken: request.authorization.bearerToken
            ? resolve(request.authorization.bearerToken)
            : request.authorization.bearerToken,
          bearerPrefix: request.authorization.bearerPrefix
            ? resolve(request.authorization.bearerPrefix)
            : request.authorization.bearerPrefix,
          basicUsername: request.authorization.basicUsername
            ? resolve(request.authorization.basicUsername)
            : request.authorization.basicUsername,
          basicPassword: request.authorization.basicPassword
            ? resolve(request.authorization.basicPassword)
            : request.authorization.basicPassword,
          apiKeyName: request.authorization.apiKeyName
            ? resolve(request.authorization.apiKeyName)
            : request.authorization.apiKeyName,
          apiKeyValue: request.authorization.apiKeyValue
            ? resolve(request.authorization.apiKeyValue)
            : request.authorization.apiKeyValue,
        }
      : undefined;
    const requestBody = request.requestBody
      ? {
          ...request.requestBody,
          content: request.requestBody.content
            ? resolve(request.requestBody.content)
            : request.requestBody.content,
          urlEncoded: request.requestBody.urlEncoded?.map((row) => ({
            ...row,
            key: resolve(row.key),
            value: resolve(row.value),
          })),
          formData: request.requestBody.formData?.map((field) =>
            field.type === 'text'
              ? { ...field, key: resolve(field.key), value: resolve(field.value) }
              : { ...field, key: resolve(field.key) }
          ),
        }
      : undefined;
    const body = normalizeRequestBody(request);
    const resolvedBody =
      body.kind === 'json' || body.kind === 'raw'
        ? requestBody?.content ?? (request.body ? resolve(request.body) : request.body)
        : undefined;

    return {
      ...request,
      authorization,
      url: resolve(request.url),
      headers: request.headers.map((h) => ({
        ...h,
        key: resolve(h.key),
        value: resolve(h.value),
      })),
      queryParams: request.queryParams.map((q) => ({
        ...q,
        key: resolve(q.key),
        value: resolve(q.value),
      })),
      body: resolvedBody,
      requestBody,
    };
  }

  buildRequestUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `{{baseUrl}}${normalizedPath}`;
  }

  async setEnvironmentType(
    workspaceRoot: string,
    envId: string,
    environmentType: EnvironmentTier
  ): Promise<Environment[]> {
    const envs = await this.getEnvironments(workspaceRoot);
    const updated = envs.map((env) => {
      if (env.id !== envId) {
        return env;
      }
      const next = { ...env, environmentType };
      saveEnvironment(workspaceRoot, next);
      return next;
    });
    this.cachedEnvironments = updated;
    return updated;
  }

  private async buildGeneratedEnvironment(workspaceRoot: string): Promise<Environment> {
    const baseUrl = await detectBaseUrlForProject(workspaceRoot);
    return {
      id: GENERATED_ENVIRONMENT_ID,
      name: GENERATED_ENVIRONMENT_NAME,
      source: 'generated',
      environmentType: 'LOCAL',
      variables: [{ name: 'baseUrl', value: baseUrl }],
    };
  }
}

import { Environment } from '../core/types';
import { EnvironmentManager } from '../environment/EnvironmentManager';

export interface SessionLoginDefaults {
  loginUrl: string;
  username: string;
  password: string;
}

export function resolveLoginUrl(envManager: EnvironmentManager, env: Environment): string {
  const custom = env.variables.find((v) => v.name === 'loginUrl')?.value?.trim();
  if (custom) {
    return envManager.resolveUrl(custom, env);
  }
  const baseUrl = env.variables.find((v) => v.name === 'baseUrl')?.value?.trim() ?? 'http://localhost:8080';
  return `${baseUrl.replace(/\/$/, '')}/login`;
}

export function getSessionLoginDefaults(
  envManager: EnvironmentManager,
  env: Environment
): SessionLoginDefaults {
  return {
    loginUrl: resolveLoginUrl(envManager, env),
    username: env.variables.find((v) => v.name === 'username')?.value?.trim() ?? '',
    password: env.variables.find((v) => v.name === 'password')?.value?.trim() ?? '',
  };
}

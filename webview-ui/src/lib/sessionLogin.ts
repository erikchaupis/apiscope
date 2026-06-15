import { resolveTemplate } from './utils';
import type { EnvironmentVariable } from '../types';

export interface SessionLoginFormValues {
  loginUrl: string;
  username: string;
  password: string;
}

export function resolveLoginUrl(variables: EnvironmentVariable[]): string {
  const custom = variables.find((v) => v.name === 'loginUrl')?.value?.trim();
  if (custom) {
    return resolveTemplate(custom, variables);
  }
  const baseUrl =
    variables.find((v) => v.name === 'baseUrl')?.value?.trim() ?? 'http://localhost:8080';
  return `${baseUrl.replace(/\/$/, '')}/login`;
}

export function getSessionLoginFormValues(variables: EnvironmentVariable[]): SessionLoginFormValues {
  return {
    loginUrl: resolveLoginUrl(variables),
    username: variables.find((v) => v.name === 'username')?.value?.trim() ?? '',
    password: variables.find((v) => v.name === 'password')?.value?.trim() ?? '',
  };
}

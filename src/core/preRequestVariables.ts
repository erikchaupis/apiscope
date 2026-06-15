import { randomInt, randomUUID } from 'crypto';
import { EnvironmentVariable, PreRequestVariable } from './types';

const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomAlphanumeric(length: number): string {
  const size = Math.max(1, Math.min(length, 256));
  let result = '';
  for (let i = 0; i < size; i++) {
    result += ALPHANUMERIC[randomInt(ALPHANUMERIC.length)];
  }
  return result;
}

function generateTimestamp(format: PreRequestVariable['timestampFormat']): string {
  const now = new Date();
  switch (format ?? 'unix-seconds') {
    case 'unix-milliseconds':
      return String(now.getTime());
    case 'iso-8601':
      return now.toISOString();
    case 'unix-seconds':
    default:
      return String(Math.floor(now.getTime() / 1000));
  }
}

function generateRandomNumber(min: number | undefined, max: number | undefined): string {
  const low = Math.min(min ?? 0, max ?? 100_000);
  const high = Math.max(min ?? 0, max ?? 100_000);
  return String(randomInt(low, high + 1));
}

function generateRandomEmail(domain: string | undefined): string {
  const host = (domain ?? 'test.com').trim() || 'test.com';
  const userNumber = randomInt(1, 100_000);
  return `user${userNumber}@${host}`;
}

export function generatePreRequestValue(variable: PreRequestVariable): string {
  switch (variable.type) {
    case 'static':
      return variable.staticValue ?? '';
    case 'uuid':
      return randomUUID();
    case 'timestamp':
      return generateTimestamp(variable.timestampFormat);
    case 'random-number':
      return generateRandomNumber(variable.min, variable.max);
    case 'random-string':
      return randomAlphanumeric(variable.length ?? 8);
    case 'random-email':
      return generateRandomEmail(variable.domain);
    default:
      return '';
  }
}

export function previewPreRequestValue(variable: PreRequestVariable): string {
  return generatePreRequestValue(variable);
}

export function generatePreRequestVariables(
  variables: PreRequestVariable[] | undefined
): EnvironmentVariable[] {
  if (!variables?.length) {
    return [];
  }
  const result: EnvironmentVariable[] = [];
  for (const variable of variables) {
    const name = variable.name.trim();
    if (!variable.enabled || !name) {
      continue;
    }
    const existing = result.findIndex((entry) => entry.name === name);
    const value = generatePreRequestValue(variable);
    if (existing >= 0) {
      result[existing] = { name, value };
    } else {
      result.push({ name, value });
    }
  }
  return result;
}

export function preRequestVariableNames(
  variables: PreRequestVariable[] | undefined
): EnvironmentVariable[] {
  if (!variables?.length) {
    return [];
  }
  const result: EnvironmentVariable[] = [];
  for (const variable of variables) {
    const name = variable.name.trim();
    if (!variable.enabled || !name) {
      continue;
    }
    const existing = result.findIndex((entry) => entry.name === name);
    if (existing >= 0) {
      result[existing] = { name, value: '' };
    } else {
      result.push({ name, value: '' });
    }
  }
  return result;
}

export function previewPreRequestVariables(
  variables: PreRequestVariable[] | undefined
): EnvironmentVariable[] {
  if (!variables?.length) {
    return [];
  }
  const result: EnvironmentVariable[] = [];
  for (const variable of variables) {
    const name = variable.name.trim();
    if (!variable.enabled || !name) {
      continue;
    }
    const existing = result.findIndex((entry) => entry.name === name);
    const value = previewPreRequestValue(variable);
    if (existing >= 0) {
      result[existing] = { name, value };
    } else {
      result.push({ name, value });
    }
  }
  return result;
}

import type { EnvironmentVariable, PreRequestVariable } from '../types';

const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomAlphanumeric(length: number): string {
  const size = Math.max(1, Math.min(length, 256));
  let result = '';
  for (let i = 0; i < size; i++) {
    result += ALPHANUMERIC[randomInt(0, ALPHANUMERIC.length - 1)];
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
  return String(randomInt(low, high));
}

function generateRandomEmail(domain: string | undefined): string {
  const host = (domain ?? 'test.com').trim() || 'test.com';
  const userNumber = randomInt(1, 100_000);
  return `user${userNumber}@${host}`;
}

export function previewPreRequestValue(variable: PreRequestVariable): string {
  switch (variable.type) {
    case 'static':
      return variable.staticValue ?? '';
    case 'uuid':
      return crypto.randomUUID();
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

export const PRE_REQUEST_VARIABLE_TYPE_LABELS: Record<PreRequestVariable['type'], string> = {
  static: 'Static Value',
  uuid: 'UUID',
  timestamp: 'Timestamp',
  'random-number': 'Random Number',
  'random-string': 'Random String',
  'random-email': 'Random Email',
};

export const TIMESTAMP_FORMAT_LABELS: Record<
  NonNullable<PreRequestVariable['timestampFormat']>,
  string
> = {
  'unix-seconds': 'Unix Seconds',
  'unix-milliseconds': 'Unix Milliseconds',
  'iso-8601': 'ISO-8601',
};

export function preRequestVariableTypeSummary(variable: PreRequestVariable): string {
  switch (variable.type) {
    case 'uuid':
      return 'UUID';
    case 'static':
      return 'Static Value';
    case 'timestamp':
      return `Timestamp (${TIMESTAMP_FORMAT_LABELS[variable.timestampFormat ?? 'unix-seconds']})`;
    case 'random-number': {
      const min = variable.min ?? 0;
      const max = variable.max ?? 100_000;
      return `Random Number (${min}-${max})`;
    }
    case 'random-string':
      return `Random String (Length: ${variable.length ?? 8})`;
    case 'random-email':
      return `Random Email (${(variable.domain ?? 'test.com').trim() || 'test.com'})`;
    default:
      return PRE_REQUEST_VARIABLE_TYPE_LABELS[variable.type];
  }
}

export function preRequestVariableHasConfig(variable: PreRequestVariable): boolean {
  return variable.type !== 'uuid';
}

export const WIZARD_VARIABLE_TYPES: PreRequestVariable['type'][] = [
  'uuid',
  'timestamp',
  'random-number',
  'random-string',
  'random-email',
  'static',
];

export function createPreRequestVariable(
  type: PreRequestVariable['type'],
  name: string
): PreRequestVariable {
  const base: PreRequestVariable = { name: name.trim(), type, enabled: true };
  switch (type) {
    case 'timestamp':
      return { ...base, timestampFormat: 'unix-seconds' };
    case 'random-number':
      return { ...base, min: 0, max: 100_000 };
    case 'random-string':
      return { ...base, length: 8 };
    case 'random-email':
      return { ...base, domain: 'test.com' };
    case 'static':
      return { ...base, staticValue: '' };
    default:
      return base;
  }
}

export function defaultPreRequestVariable(): PreRequestVariable {
  return {
    name: '',
    type: 'uuid',
    enabled: true,
  };
}

export function getPreRequestVariables(request: import('../types').ApiRequest): PreRequestVariable[] {
  return request.automation?.preRequestVariables ?? [];
}

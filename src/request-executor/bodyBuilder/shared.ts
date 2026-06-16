export interface ModelField {
  name: string;
  type: string;
}

export const EXAMPLE_STRINGS: Record<string, string> = {
  name: 'Jane',
  lastname: 'Doe',
  firstname: 'Jane',
  firstName: 'Jane',
  lastName: 'Doe',
  username: 'jane',
  password: 'secret',
  refreshToken: 'example-refresh-token',
  email: 'jane@example.com',
  title: 'Example',
  description: 'Example description',
};

export function formatJsonBody(body: Record<string, unknown>): string {
  return JSON.stringify(body, null, 2);
}

export function exampleValueForField(field: ModelField): unknown {
  if (field.name in EXAMPLE_STRINGS) {
    return EXAMPLE_STRINGS[field.name];
  }

  return exampleValueForType(field.type, field.name);
}

export function exampleValueForType(type: string, fieldName?: string): unknown {
  const normalized = type.toLowerCase().replace(/\s+/g, '');

  if (
    normalized.includes('long') ||
    normalized.includes('integer') ||
    normalized.includes('int') ||
    normalized.includes('short') ||
    normalized === 'number'
  ) {
    return fieldName === 'id' ? 1 : 0;
  }
  if (normalized.includes('bool')) {
    return true;
  }
  if (
    normalized.includes('double') ||
    normalized.includes('float') ||
    normalized.includes('decimal')
  ) {
    return 0;
  }
  if (
    normalized.includes('list') ||
    normalized.includes('set') ||
    normalized.includes('tuple') ||
    normalized.includes('sequence') ||
    normalized.includes('[]')
  ) {
    return [];
  }
  if (normalized.includes('dict') || normalized.includes('map') || normalized.includes('object')) {
    return { example: 'value' };
  }
  return 'example';
}

export function buildJsonBodyFromFields(
  fields: ModelField[],
  options?: { includeId?: boolean }
): string {
  const includeId = options?.includeId ?? false;
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    if (!includeId && field.name === 'id') {
      continue;
    }
    body[field.name] = exampleValueForField(field);
  }
  return formatJsonBody(body);
}

export function readSliceAroundLine(content: string, line: number, before = 20, after = 15): string {
  const lines = content.split('\n');
  const start = Math.max(0, line - 1 - before);
  const end = Math.min(lines.length, line - 1 + after);
  return lines.slice(start, end).join('\n');
}

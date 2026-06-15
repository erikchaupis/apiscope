import * as fs from 'fs';
import * as path from 'path';
import { Endpoint } from '../core/types';

interface ModelField {
  name: string;
  type: string;
}

const EXAMPLE_STRINGS: Record<string, string> = {
  name: 'Jane',
  lastname: 'Doe',
  firstname: 'Jane',
  email: 'jane@example.com',
  title: 'Example',
  description: 'Example description',
};

export function buildExampleRequestBody(endpoint: Endpoint): string | undefined {
  if (endpoint.method === 'GET' || endpoint.method === 'DELETE') {
    return undefined;
  }

  const fields = resolveRequestBodyFields(endpoint);
  if (!fields.length) {
    return formatJsonBody({ name: 'Jane', lastname: 'Doe' });
  }

  const includeId = endpoint.method === 'PUT' && fields.some((f) => f.name === 'id');
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    if (!includeId && field.name === 'id') {
      continue;
    }
    body[field.name] = exampleValueForField(field);
  }
  return formatJsonBody(body);
}

function resolveRequestBodyFields(endpoint: Endpoint): ModelField[] {
  try {
    const controllerContent = fs.readFileSync(endpoint.filePath, 'utf-8');
    const packageName = extractPackage(controllerContent);
    const requestBodyType = extractRequestBodyType(controllerContent, endpoint);
    if (!requestBodyType) {
      return [];
    }

    const classPath = findClassFile(endpoint.filePath, packageName, requestBodyType);
    if (!classPath) {
      return [];
    }

    return parseJavaFields(fs.readFileSync(classPath, 'utf-8'));
  } catch {
    return [];
  }
}

function extractPackage(content: string): string | undefined {
  const match = content.match(/^\s*package\s+([\w.]+)\s*;/m);
  return match?.[1];
}

function extractRequestBodyType(content: string, endpoint: Endpoint): string | undefined {
  if (endpoint.line) {
    const lines = content.split('\n');
    const start = Math.max(0, endpoint.line - 20);
    const end = Math.min(lines.length, endpoint.line + 5);
    const slice = lines.slice(start, end).join('\n');
    const match = slice.match(/@RequestBody\s+(\w+)/);
    if (match) {
      return match[1];
    }
  }

  const globalMatch = content.match(/@RequestBody\s+(\w+)/);
  return globalMatch?.[1];
}

function findClassFile(
  controllerPath: string,
  packageName: string | undefined,
  className: string
): string | undefined {
  const dir = path.dirname(controllerPath);
  const sibling = path.join(dir, `${className}.java`);
  if (fs.existsSync(sibling)) {
    return sibling;
  }

  if (packageName) {
    const workspaceRoot = findWorkspaceRoot(controllerPath);
    if (workspaceRoot) {
      const fromPackage = path.join(
        workspaceRoot,
        'src',
        'main',
        'java',
        ...packageName.split('.'),
        `${className}.java`
      );
      if (fs.existsSync(fromPackage)) {
        return fromPackage;
      }
    }
  }

  return undefined;
}

function findWorkspaceRoot(filePath: string): string | undefined {
  let dir = path.dirname(filePath);
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, 'pom.xml')) || fs.existsSync(path.join(dir, 'build.gradle'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return undefined;
}

function parseJavaFields(content: string): ModelField[] {
  const fields: ModelField[] = [];
  const regex = /private\s+([\w.<>,\s\[\]]+?)\s+(\w+)\s*;/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const type = match[1].trim();
    const name = match[2];
    if (name === 'serialVersionUID') {
      continue;
    }
    fields.push({ name, type });
  }
  return fields;
}

function exampleValueForField(field: ModelField): unknown {
  if (field.name in EXAMPLE_STRINGS) {
    return EXAMPLE_STRINGS[field.name];
  }

  const type = field.type.toLowerCase();
  if (type.includes('long') || type.includes('integer') || type.includes('int') || type.includes('short')) {
    return field.name === 'id' ? 1 : 0;
  }
  if (type.includes('boolean')) {
    return true;
  }
  if (type.includes('double') || type.includes('float') || type.includes('bigdecimal')) {
    return 0;
  }
  if (type.includes('list') || type.includes('set') || type.includes('collection')) {
    return [];
  }
  if (type.includes('map')) {
    return {};
  }
  return 'example';
}

function formatJsonBody(body: Record<string, unknown>): string {
  return JSON.stringify(body, null, 2);
}

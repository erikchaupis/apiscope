import * as fs from 'fs';
import * as path from 'path';
import type { Endpoint } from '../../core/types';
import type { RequestBody } from '../../core/requestBody';
import {
  buildJsonBodyFromFields,
  exampleValueForField,
  readSliceAroundLine,
  type ModelField,
} from './shared';

export interface SpringRequestBodyResult {
  body?: string;
  requestBody?: RequestBody;
}

const REQUEST_BODY_TYPE_REGEX =
  /(?:@\w+(?:\s*\([^)]*\))?\s+)*@RequestBody(?:\s*\([^)]*\))?\s+(?:@\w+(?:\s*\([^)]*\))?\s+)*(?:final\s+)?([\w.]+)/;

const REQUEST_PARAM_REGEX =
  /@RequestParam(?:\s*\([^)]*\))?\s+(?:@\w+(?:\s*\([^)]*\))?\s+)*(?:final\s+)?([\w.<>,\s\[\]]+?)\s+(\w+)/g;

export function buildSpringRequestBody(endpoint: Endpoint): SpringRequestBodyResult | undefined {
  let content: string;
  try {
    content = fs.readFileSync(endpoint.filePath, 'utf-8');
  } catch {
    return undefined;
  }

  const requestBodyType = extractRequestBodyType(content, endpoint.line);
  if (requestBodyType) {
    const fields = resolveJavaModelFields(content, endpoint.filePath, requestBodyType);
    if (!fields.length) {
      return undefined;
    }

    const includeId = endpoint.method === 'PUT' && fields.some((f) => f.name === 'id');
    const json = buildJsonBodyFromFields(fields, { includeId });
    return {
      body: json,
      requestBody: {
        kind: 'json',
        content: json,
      },
    };
  }

  const formFields = extractRequestParamFields(
    endpoint.line ? readMethodChunk(content, endpoint.line) : content
  );
  if (formFields.length) {
    return {
      requestBody: {
        kind: 'form-urlencoded',
        urlEncoded: formFields.map((field) => ({
          key: field.name,
          value: String(exampleValueForField(field)),
          enabled: true,
        })),
      },
    };
  }

  return undefined;
}

function extractRequestBodyType(content: string, endpointLine?: number): string | undefined {
  if (!endpointLine) {
    const match = content.match(REQUEST_BODY_TYPE_REGEX);
    return match ? simplifyTypeName(match[1]) : undefined;
  }

  const chunk = readMethodChunk(content, endpointLine);
  const match = chunk.match(REQUEST_BODY_TYPE_REGEX);
  return match ? simplifyTypeName(match[1]) : undefined;
}

function readMethodChunk(content: string, endpointLine: number): string {
  const lines = content.split('\n');
  let mappingIndex = endpointLine - 1;

  while (mappingIndex > 0 && !/@\w+Mapping\b/.test(lines[mappingIndex] ?? '')) {
    mappingIndex--;
  }

  let endIndex = lines.length;
  for (let i = mappingIndex + 1; i < lines.length; i++) {
    if (/@\w+Mapping\b/.test(lines[i] ?? '')) {
      endIndex = i;
      break;
    }
  }

  return lines.slice(mappingIndex, endIndex).join('\n');
}

function simplifyTypeName(typeName: string): string {
  const parts = typeName.split('.');
  return parts[parts.length - 1] ?? typeName;
}

function extractRequestParamFields(slice: string): ModelField[] {
  const fields: ModelField[] = [];
  let match: RegExpExecArray | null;
  while ((match = REQUEST_PARAM_REGEX.exec(slice)) !== null) {
    fields.push({ type: match[1].trim(), name: match[2] });
  }
  return fields;
}

function resolveJavaModelFields(
  controllerContent: string,
  controllerPath: string,
  typeName: string
): ModelField[] {
  const classPath = findJavaClassFile(controllerContent, controllerPath, typeName);
  if (!classPath) {
    return [];
  }

  let classContent: string;
  try {
    classContent = fs.readFileSync(classPath, 'utf-8');
  } catch {
    return [];
  }

  const recordFields = parseJavaRecordFields(classContent);
  if (recordFields.length) {
    return recordFields;
  }

  return parseJavaPrivateFields(classContent);
}

function parseJavaRecordFields(content: string): ModelField[] {
  const recordStart = content.match(/\brecord\s+\w+\s*\(/);
  if (!recordStart || recordStart.index === undefined) {
    return [];
  }

  const openParen = content.indexOf('(', recordStart.index);
  const body = extractBalancedParenContent(content, openParen);
  if (!body) {
    return [];
  }

  const fields: ModelField[] = [];
  for (const part of splitRecordComponents(body)) {
    const field = parseRecordComponent(part);
    if (field) {
      fields.push(field);
    }
  }
  return fields;
}

function extractBalancedParenContent(content: string, openParenIndex: number): string | undefined {
  if (content[openParenIndex] !== '(') {
    return undefined;
  }

  let depth = 0;
  let inString: '"' | "'" | null = null;

  for (let i = openParenIndex; i < content.length; i++) {
    const ch = content[i];
    const prev = content[i - 1];

    if (inString) {
      if (ch === inString && prev !== '\\') {
        inString = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }

    if (ch === '(') {
      depth++;
      continue;
    }

    if (ch === ')') {
      depth--;
      if (depth === 0) {
        return content.slice(openParenIndex + 1, i);
      }
    }
  }

  return undefined;
}

function stripJavaAnnotations(fragment: string): string {
  let result = fragment.trim();
  while (true) {
    const without = result.replace(/^@\w+(?:\((?:[^()"']|"[^"]*"|'[^']*')*\))?\s+/, '');
    if (without === result) {
      break;
    }
    result = without.trim();
  }
  return result.replace(/^final\s+/, '').trim();
}

function parseRecordComponent(part: string): ModelField | undefined {
  const stripped = stripJavaAnnotations(part);
  const component = stripped.match(/^([\w.<>,\s\[\]]+?)\s+(\w+)$/);
  if (!component) {
    return undefined;
  }
  return { type: component[1].trim(), name: component[2] };
}

function splitRecordComponents(body: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (const ch of body) {
    if (ch === '<') {
      depth++;
    } else if (ch === '>') {
      depth = Math.max(0, depth - 1);
    }

    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }

  if (current.trim()) {
    parts.push(current);
  }
  return parts;
}

function parseJavaPrivateFields(content: string): ModelField[] {
  const fields: ModelField[] = [];
  const regex = /private\s+([\w.<>,\s\[\]]+?)\s+(\w+)\s*;/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const name = match[2];
    if (name === 'serialVersionUID') {
      continue;
    }
    fields.push({ name, type: match[1].trim() });
  }
  return fields;
}

function extractPackage(content: string): string | undefined {
  return content.match(/^\s*package\s+([\w.]+)\s*;/m)?.[1];
}

function extractImports(content: string): Map<string, string> {
  const imports = new Map<string, string>();
  const regex = /^\s*import\s+(?:static\s+)?([\w.]+)\s*;/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const fqcn = match[1];
    const simpleName = fqcn.split('.').pop();
    if (simpleName) {
      imports.set(simpleName, fqcn);
    }
  }
  return imports;
}

function findJavaClassFile(
  controllerContent: string,
  controllerPath: string,
  typeName: string
): string | undefined {
  if (typeName.includes('.')) {
    const fromFqn = javaFqnToPath(controllerPath, typeName);
    if (fromFqn && fs.existsSync(fromFqn)) {
      return fromFqn;
    }
  }

  const simpleName = simplifyTypeName(typeName);
  const controllerDir = path.dirname(controllerPath);
  const sibling = path.join(controllerDir, `${simpleName}.java`);
  if (fs.existsSync(sibling)) {
    return sibling;
  }

  const packageName = extractPackage(controllerContent);
  if (packageName) {
    const fromPackage = javaFqnToPath(controllerPath, `${packageName}.${simpleName}`);
    if (fromPackage && fs.existsSync(fromPackage)) {
      return fromPackage;
    }
  }

  const imported = extractImports(controllerContent).get(simpleName);
  if (imported) {
    const fromImport = javaFqnToPath(controllerPath, imported);
    if (fromImport && fs.existsSync(fromImport)) {
      return fromImport;
    }
  }

  return findJavaClassByName(controllerPath, simpleName);
}

function javaFqnToPath(sourcePath: string, fqcn: string): string | undefined {
  const workspaceRoot = findWorkspaceRoot(sourcePath);
  if (!workspaceRoot) {
    return undefined;
  }

  const relative = fqcn.split('.').join(path.sep) + '.java';
  const candidates = [
    path.join(workspaceRoot, 'src', 'main', 'java', relative),
    path.join(workspaceRoot, 'src', 'test', 'java', relative),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function findJavaClassByName(sourcePath: string, className: string): string | undefined {
  const workspaceRoot = findWorkspaceRoot(sourcePath);
  if (!workspaceRoot) {
    return undefined;
  }

  const roots = [
    path.join(workspaceRoot, 'src', 'main', 'java'),
    path.join(workspaceRoot, 'src', 'test', 'java'),
  ];

  for (const root of roots) {
    const found = walkForJavaClass(root, className);
    if (found) {
      return found;
    }
  }

  return undefined;
}

function walkForJavaClass(dir: string, className: string): string | undefined {
  if (!fs.existsSync(dir)) {
    return undefined;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'target' || entry.name === '.git') {
        continue;
      }
      const nested = walkForJavaClass(full, className);
      if (nested) {
        return nested;
      }
      continue;
    }

    if (entry.isFile() && entry.name === `${className}.java`) {
      return full;
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

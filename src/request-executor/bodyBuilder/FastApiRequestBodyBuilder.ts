import * as fs from 'fs';
import * as path from 'path';
import type { Endpoint } from '../../core/types';
import type { RequestBody } from '../../core/requestBody';
import {
  buildJsonBodyFromFields,
  exampleValueForType,
  formatJsonBody,
  type ModelField,
} from './shared';

export interface FastApiRequestBodyResult {
  body?: string;
  requestBody?: RequestBody;
}

function hasFastApiInjection(param: string): boolean {
  if (/\bDepends\s*\(/.test(param)) return true;
  if (/\bPath\s*\(/.test(param)) return true;
  if (/\bQuery\s*\(/.test(param)) return true;
  if (/\bHeader\s*\(/.test(param)) return true;
  if (/\bCookie\s*\(/.test(param)) return true;
  if (/\bFile\s*\(/.test(param)) return true;
  if (/\bForm\s*\(/.test(param)) return true;
  if (/\bBody\s*\(/.test(param)) return true;
  if (/\bUploadFile\b/.test(param)) return true;
  if (/^\s*request\s*:/i.test(param) || /,\s*request\s*:/i.test(param)) return true;
  if (/^\s*response\s*:/i.test(param) || /,\s*response\s*:/i.test(param)) return true;
  return false;
}

export function buildFastApiRequestBody(endpoint: Endpoint): FastApiRequestBodyResult | undefined {
  let content: string;
  try {
    content = fs.readFileSync(endpoint.filePath, 'utf-8');
  } catch {
    return undefined;
  }

  const signature = extractFunctionSignature(content, endpoint.line);
  if (!signature) {
    return undefined;
  }

  const pathParams = extractPathParamNames(endpoint.path);
  const bodyFields = extractFastApiBodyFields(signature, pathParams);
  if (!bodyFields.length) {
    return undefined;
  }

  const resolvedFields = resolveFastApiFields(content, endpoint.filePath, bodyFields);
  if (!resolvedFields.length) {
    return undefined;
  }

  const json = formatFastApiJsonBody(bodyFields, resolvedFields);
  return {
    body: json,
    requestBody: { kind: 'json', content: json },
  };
}

function formatFastApiJsonBody(originalParams: ModelField[], resolvedFields: ModelField[]): string {
  if (
    originalParams.length === 1 &&
    isBuiltinPythonType(originalParams[0].type) &&
    resolvedFields.length === 1 &&
    resolvedFields[0].name === originalParams[0].name
  ) {
    const type = originalParams[0].type.toLowerCase().replace(/\s+/g, '');
    if (type.startsWith('dict')) {
      return formatJsonBody({ example: 'value' });
    }
    if (type.startsWith('list')) {
      return JSON.stringify([], null, 2);
    }
    return formatJsonBody({
      [originalParams[0].name]: exampleValueForType(originalParams[0].type, originalParams[0].name),
    });
  }

  return buildJsonBodyFromFields(resolvedFields);
}

function extractPathParamNames(routePath: string): Set<string> {
  const names = new Set<string>();
  const regex = /\{(\w+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(routePath)) !== null) {
    names.add(match[1]);
  }
  return names;
}

function extractFunctionSignature(content: string, decoratorLine?: number): string | undefined {
  if (!decoratorLine) {
    const match = content.match(/def\s+\w+\s*\(/);
    if (!match || match.index === undefined) {
      return undefined;
    }
    return extractDefParams(content, match.index + match[0].length - 1);
  }

  const lines = content.split('\n');
  for (let i = decoratorLine - 1; i < Math.min(lines.length, decoratorLine + 7); i++) {
    const line = lines[i];
    const defIndex = line.indexOf('def ');
    if (defIndex < 0) {
      continue;
    }
    const openParen = line.indexOf('(', defIndex);
    if (openParen < 0) {
      continue;
    }
    const lineStart = content.split('\n').slice(0, i).join('\n').length + (i > 0 ? 1 : 0);
    const params = extractDefParams(content, lineStart + openParen);
    if (params !== undefined) {
      return params;
    }
  }

  return undefined;
}

function extractDefParams(content: string, openParenIndex: number): string | undefined {
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

function extractFastApiBodyFields(signature: string, pathParams: Set<string>): ModelField[] {
  const params = splitPythonParams(signature);
  const fields: ModelField[] = [];

  for (const param of params) {
    const trimmed = param.trim();
    if (!trimmed || trimmed === 'self' || trimmed === 'cls' || trimmed.startsWith('*')) {
      continue;
    }

    const parsed = parsePythonParam(trimmed);
    if (!parsed) {
      continue;
    }

    if (pathParams.has(parsed.name)) {
      continue;
    }

    if (hasFastApiInjection(parsed.raw)) {
      continue;
    }

    if (isBuiltinPythonType(parsed.type)) {
      fields.push(parsed);
      continue;
    }

    if (isModelType(parsed.type)) {
      return [{ name: parsed.name, type: parsed.type }];
    }
  }

  return fields;
}

function splitPythonParams(signature: string): string[] {
  const params: string[] = [];
  let current = '';
  let depth = 0;

  for (const ch of signature) {
    if (ch === '[' || ch === '(' || ch === '{') {
      depth++;
    } else if (ch === ']' || ch === ')' || ch === '}') {
      depth = Math.max(0, depth - 1);
    }

    if (ch === ',' && depth === 0) {
      params.push(current);
      current = '';
      continue;
    }
    current += ch;
  }

  if (current.trim()) {
    params.push(current);
  }
  return params;
}

function parsePythonParam(param: string): (ModelField & { raw: string }) | undefined {
  const withoutDefault = param.split('=')[0]?.trim() ?? param.trim();
  const annotated = withoutDefault.match(/^(\w+)\s*:\s*Annotated\s*\[\s*([^,\]]+)/);
  if (annotated) {
    return {
      name: annotated[1],
      type: annotated[2].trim(),
      raw: param,
    };
  }

  const typed = withoutDefault.match(/^(\w+)\s*:\s*(.+)$/);
  if (typed) {
    return {
      name: typed[1],
      type: typed[2].trim(),
      raw: param,
    };
  }

  return undefined;
}

function isBuiltinPythonType(type: string): boolean {
  const normalized = type.toLowerCase().replace(/\s+/g, '');
  return (
    normalized === 'str' ||
    normalized === 'int' ||
    normalized === 'float' ||
    normalized === 'bool' ||
    normalized.startsWith('dict[') ||
    normalized.startsWith('dict') ||
    normalized.startsWith('list[') ||
    normalized.startsWith('list') ||
    normalized.startsWith('optional[')
  );
}

function isModelType(type: string): boolean {
  const base = type.split('[')[0]?.trim() ?? type;
  return /^[A-Z]\w*$/.test(base) && !['Dict', 'List', 'Optional', 'Union', 'Any', 'Annotated'].includes(base);
}

function resolveFastApiFields(
  fileContent: string,
  filePath: string,
  bodyFields: ModelField[]
): ModelField[] {
  if (bodyFields.length === 1 && isModelType(bodyFields[0].type)) {
    const modelFields = resolvePydanticModelFields(fileContent, filePath, bodyFields[0].type);
    if (modelFields.length) {
      return modelFields;
    }
  }

  const resolved: ModelField[] = [];
  for (const field of bodyFields) {
    if (isModelType(field.type)) {
      const modelFields = resolvePydanticModelFields(fileContent, filePath, field.type);
      if (modelFields.length) {
        resolved.push(...modelFields);
        continue;
      }
    }
    resolved.push(field);
  }
  return resolved;
}

function resolvePydanticModelFields(
  fileContent: string,
  filePath: string,
  modelName: string
): ModelField[] {
  const localFields = parsePydanticModelFields(fileContent, modelName);
  if (localFields.length) {
    return localFields;
  }

  const importedPath = resolvePythonImportPath(fileContent, filePath, modelName);
  if (!importedPath) {
    return [];
  }

  try {
    return parsePydanticModelFields(fs.readFileSync(importedPath, 'utf-8'), modelName);
  } catch {
    return [];
  }
}

function parsePydanticModelFields(content: string, modelName: string): ModelField[] {
  const classMatch = content.match(
    new RegExp(`class\\s+${modelName}\\s*\\([^\\)]*\\)\\s*:\\s*([\\s\\S]*?)(?=\\nclass\\s+|\\ndef\\s+|\\n@|$)`)
  );
  if (!classMatch) {
    return [];
  }

  const fields: ModelField[] = [];
  for (const line of classMatch[1].split('\n')) {
    const match = line.match(/^\s*(\w+)\s*:\s*([^=#]+?)\s*(?:=.*)?$/);
    if (!match) {
      continue;
    }
    fields.push({ name: match[1], type: match[2].trim() });
  }
  return fields;
}

function resolvePythonImportPath(
  fileContent: string,
  filePath: string,
  symbolName: string
): string | undefined {
  for (const entry of collectPythonFromImports(fileContent)) {
    if (entry.symbols.includes(symbolName)) {
      const resolved = pythonModuleToPath(filePath, entry.module);
      if (resolved) {
        return resolved;
      }
    }
  }

  const directImport = fileContent.match(
    new RegExp(`^\\s*import\\s+([\\w.]+)\\.${symbolName}\\b`, 'm')
  );
  if (directImport) {
    return pythonModuleToPath(filePath, directImport[1]);
  }

  return findPythonFileByName(path.dirname(filePath), symbolName);
}

function collectPythonFromImports(
  fileContent: string
): Array<{ module: string; symbols: string[] }> {
  const results: Array<{ module: string; symbols: string[] }> = [];
  const lines = fileContent.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^\s*from\s+([\w.]+)\s+import\s+(.+)$/);
    if (!match) {
      continue;
    }

    let importPart = match[2].trim();
    if (importPart.startsWith('(') && !importPart.includes(')')) {
      let combined = importPart;
      while (i + 1 < lines.length && !combined.includes(')')) {
        i++;
        combined += `\n${lines[i]}`;
      }
      importPart = combined;
    }

    const symbols = importPart
      .replace(/[()]/g, '')
      .split(',')
      .map((part) => part.trim().split(/\s+as\s+/)[0]?.trim())
      .filter(Boolean);

    results.push({ module: match[1], symbols });
  }

  return results;
}

function pythonModuleToPath(fromFile: string, module: string): string | undefined {
  const dir = path.dirname(fromFile);
  const relative = module.replace(/\./g, path.sep);
  const candidates = [
    path.join(dir, `${relative}.py`),
    path.join(dir, relative, '__init__.py'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const workspaceRoot = findWorkspaceRoot(fromFile);
  if (!workspaceRoot) {
    return undefined;
  }

  const fromRoot = path.join(workspaceRoot, `${relative}.py`);
  return fs.existsSync(fromRoot) ? fromRoot : undefined;
}

function findPythonFileByName(dir: string, fileBase: string): string | undefined {
  const workspaceRoot = findWorkspaceRoot(dir) ?? dir;
  return walkForPythonFile(workspaceRoot, `${fileBase}.py`);
}

function walkForPythonFile(dir: string, fileName: string): string | undefined {
  if (!fs.existsSync(dir)) {
    return undefined;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '__pycache__') {
        continue;
      }
      const nested = walkForPythonFile(full, fileName);
      if (nested) {
        return nested;
      }
      continue;
    }

    if (entry.isFile() && entry.name === fileName) {
      return full;
    }
  }

  return undefined;
}

function findWorkspaceRoot(filePath: string): string | undefined {
  let dir = path.dirname(filePath);
  for (let i = 0; i < 12; i++) {
    if (
      fs.existsSync(path.join(dir, 'pyproject.toml')) ||
      fs.existsSync(path.join(dir, 'requirements.txt')) ||
      fs.existsSync(path.join(dir, 'app.py'))
    ) {
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

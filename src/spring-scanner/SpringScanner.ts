import * as fs from 'fs';
import * as path from 'path';
import { Endpoint, HttpMethod } from '../core/types';
import { FrameworkScanner, ScanContext } from '../scanner/FrameworkScanner';
import { detectSpringProject } from './SpringProjectDetector';

const CONTROLLER_ANNOTATIONS = /@(?:RestController|Controller)\b/;

export class SpringScanner implements FrameworkScanner {
  readonly frameworkId = 'spring';
  readonly frameworkLabel = 'Spring Boot';

  async canScan(workspaceRoot: string): Promise<boolean> {
    const info = await detectSpringProject(workspaceRoot);
    return info.detected;
  }

  async scan(context: ScanContext): Promise<Endpoint[]> {
    const javaFiles = await findJavaFiles(context.workspaceRoot, context.sourcePaths);
    const endpoints: Endpoint[] = [];

    for (const filePath of javaFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (!CONTROLLER_ANNOTATIONS.test(content)) {
        continue;
      }
      const className = extractClassName(content) ?? path.basename(filePath, '.java');
      const collectionName = toCollectionName(className);
      const classPath = extractClassRequestMapping(content);
      const methodEndpoints = extractMethodEndpoints(content, filePath, className, collectionName, classPath);
      endpoints.push(...methodEndpoints);
    }

    const unique = dedupeEndpoints(endpoints);
    return unique.sort((a, b) => {
      const nameCmp = a.collectionName.localeCompare(b.collectionName);
      if (nameCmp !== 0) {
        return nameCmp;
      }
      const pathCmp = a.path.localeCompare(b.path);
      if (pathCmp !== 0) {
        return pathCmp;
      }
      return a.method.localeCompare(b.method);
    });
  }
}

async function findJavaFiles(workspaceRoot: string, sourcePaths?: string[]): Promise<string[]> {
  const roots = sourcePaths?.length
    ? sourcePaths
    : [path.join(workspaceRoot, 'src', 'main', 'java')];
  const files: string[] = [];

  for (const root of roots) {
    if (!fs.existsSync(root)) {
      continue;
    }
    await walkDir(root, files);
  }

  if (files.length === 0 && !sourcePaths?.length) {
    await walkDir(workspaceRoot, files, (p) => p.endsWith('.java'));
  }

  return files;
}

async function walkDir(
  dir: string,
  files: string[],
  filter: (p: string) => boolean = (p) => p.endsWith('.java')
): Promise<void> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target') {
        continue;
      }
      await walkDir(full, files, filter);
    } else if (filter(full)) {
      files.push(full);
    }
  }
}

function extractClassName(content: string): string | undefined {
  const match = content.match(/class\s+(\w+)/);
  return match?.[1];
}

function toCollectionName(className: string): string {
  const base = className.replace(/Controller$/, '');
  if (!base) {
    return className;
  }
  return base.replace(/([a-z])([A-Z])/g, '$1 $2').trim() || className;
}

function extractClassRequestMapping(content: string): string {
  const patterns = [
    /@RequestMapping\s*\(\s*["']([^"']+)["']/,
    /@RequestMapping\s*\(\s*value\s*=\s*["']([^"']+)["']/,
    /@RequestMapping\s*\(\s*path\s*=\s*["']([^"']+)["']/,
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return normalizePath(match[1]);
    }
  }
  return '';
}

function extractNamedStringArg(args: string, key: string): string | undefined {
  const match = args.match(new RegExp(`${key}\\s*=\\s*["']([^"']+)["']`));
  return match?.[1];
}

function extractOperationMetadata(block: string): { summary?: string; operationId?: string } {
  const opMatch = block.match(/@Operation\s*\(([\s\S]*?)\)/);
  if (!opMatch) {
    return {};
  }
  return {
    summary: extractNamedStringArg(opMatch[1], 'summary'),
    operationId: extractNamedStringArg(opMatch[1], 'operationId'),
  };
}

function extractMethodEndpoints(
  content: string,
  filePath: string,
  className: string,
  collectionName: string,
  classPath: string
): Endpoint[] {
  const endpoints: Endpoint[] = [];
  const methodBlocks = splitIntoMethods(content);

  for (const block of methodBlocks) {
    const line = content.substring(0, block.startIndex).split('\n').length;
    const metadata = extractOperationMetadata(block.text);

    for (const mapping of extractMappingsFromBlock(block.text)) {
      const fullPath = joinPaths(classPath, mapping.path);
      const id = `${className}:${mapping.method}:${fullPath}`;
      endpoints.push({
        id,
        method: mapping.method,
        path: fullPath,
        controllerName: className,
        collectionName,
        filePath,
        line,
        summary: metadata.summary,
        operationId: metadata.operationId,
      });
    }
  }

  return endpoints;
}

interface MethodBlock {
  startIndex: number;
  text: string;
}

function findBalancedParenEnd(content: string, openIndex: number): number {
  if (content[openIndex] !== '(') {
    return -1;
  }

  let depth = 0;
  let inString: '"' | "'" | null = null;

  for (let i = openIndex; i < content.length; i++) {
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
    } else if (ch === ')') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

function extractAnnotationArgs(content: string, atIndex: number): string {
  const open = content.indexOf('(', atIndex);
  if (open < 0) {
    return '';
  }
  const close = findBalancedParenEnd(content, open);
  if (close < 0) {
    return '';
  }
  return content.slice(open + 1, close);
}

function splitIntoMethods(content: string): MethodBlock[] {
  const blocks: MethodBlock[] = [];
  const seenStarts = new Set<number>();
  const visibilityRegex = /\b(public|protected|private)\b/g;
  let visMatch: RegExpExecArray | null;

  while ((visMatch = visibilityRegex.exec(content)) !== null) {
    const start = visMatch.index;
    const slice = content.slice(start);
    const sigMatch = slice.match(
      /^(public|protected|private)\s+(?:(?:static|final|synchronized|native|abstract)\s+)*(?:[\w.<>,\[\]\s?]+)\s+(\w+)\s*\(/
    );
    if (!sigMatch) {
      continue;
    }

    const openParen = start + sigMatch[0].length - 1;
    const closeParen = findBalancedParenEnd(content, openParen);
    if (closeParen < 0) {
      continue;
    }

    const afterClose = content.slice(closeParen + 1);
    const bodyMatch = afterClose.match(/^\s*(?:throws\s+[\w.<>,\s]+)?\s*\{/);
    if (!bodyMatch) {
      continue;
    }

    const annotationStart = findAnnotationStart(content, start);
    if (seenStarts.has(annotationStart)) {
      continue;
    }
    seenStarts.add(annotationStart);

    const end = closeParen + 1 + bodyMatch[0].length;
    blocks.push({
      startIndex: annotationStart,
      text: content.slice(annotationStart, end),
    });
  }

  return blocks;
}

function findAnnotationStart(content: string, methodStart: number): number {
  let pos = methodStart;
  while (pos > 0) {
    const prev = content.lastIndexOf('\n', pos - 1);
    const line = content.slice(prev + 1, pos).trim();
    if (line === '' || line.startsWith('@')) {
      pos = prev === -1 ? 0 : prev;
      if (line.startsWith('@')) {
        return prev + 1;
      }
      continue;
    }
    return prev + 1;
  }
  return 0;
}

interface ParsedMapping {
  method: HttpMethod;
  path: string;
}

function extractMappingsFromBlock(block: string): ParsedMapping[] {
  const mappings: ParsedMapping[] = [];
  const seen = new Set<string>();

  const add = (method: HttpMethod, path: string, key: string) => {
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    mappings.push({ method, path: normalizePath(path) });
  };

  const mappingRegex = /@(Get|Post|Put|Delete|Patch)Mapping\b/g;
  let m: RegExpExecArray | null;
  while ((m = mappingRegex.exec(block)) !== null) {
    const verb = m[1].toUpperCase() as HttpMethod;
    const args = extractAnnotationArgs(block, m.index);
    const pathMatch = args.match(/(?:value\s*=\s*|path\s*=\s*)?["']([^"']*)["']/);
    const path = pathMatch?.[1] ?? '';
    add(verb, path, `${m[0]}(${args})`);
  }

  const requestMappingRegex = /@RequestMapping\b/g;
  let rm: RegExpExecArray | null;
  while ((rm = requestMappingRegex.exec(block)) !== null) {
    const args = extractAnnotationArgs(block, rm.index);
    const pathMatch = args.match(/(?:value\s*=\s*|path\s*=\s*)["']([^"']+)["']/);
    const methodMatch = args.match(/method\s*=\s*RequestMethod\.(\w+)/);
    if (!pathMatch || !methodMatch) {
      continue;
    }
    const httpMethod = requestMethodToHttp(methodMatch[1]);
    if (httpMethod) {
      add(httpMethod, pathMatch[1], `${rm[0]}(${args})`);
    }
  }

  return mappings;
}

function dedupeEndpoints(endpoints: Endpoint[]): Endpoint[] {
  const seen = new Set<string>();
  return endpoints.filter((ep) => {
    const key = `${ep.controllerName}:${ep.method}:${ep.path}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function requestMethodToHttp(method: string): HttpMethod | undefined {
  const map: Record<string, HttpMethod> = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE',
    PATCH: 'PATCH',
  };
  return map[method.toUpperCase()];
}

function normalizePath(p: string): string {
  if (!p) {
    return '';
  }
  let path = p.trim();
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  return path.replace(/\/+/g, '/');
}

function joinPaths(classPath: string, methodPath: string): string {
  const combined = `${classPath}${methodPath}`.replace(/\/+/g, '/');
  if (!combined || combined === '/') {
    return '/';
  }
  return combined.startsWith('/') ? combined : `/${combined}`;
}

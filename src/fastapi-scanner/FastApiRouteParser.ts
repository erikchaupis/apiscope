import * as fs from 'fs';
import * as path from 'path';
import { Endpoint, HttpMethod } from '../core/types';
import { findPythonFiles, shouldSkipDir } from './FastApiProjectDetector';

const ROUTE_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch']);

const HTTP_METHOD_MAP: Record<string, HttpMethod> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  delete: 'DELETE',
  patch: 'PATCH',
};

interface IncludeEdge {
  appVar: string;
  routerVar: string;
  prefix: string;
}

interface ParsedRoute {
  receiverVar: string;
  method: HttpMethod;
  path: string;
  line: number;
  filePath: string;
  controllerName: string;
  collectionName: string;
  summary?: string;
  operationId?: string;
}

interface FileAnalysis {
  absolutePath: string;
  relativePath: string;
  apps: Set<string>;
  routers: Set<string>;
  routerPrefixes: Map<string, string>;
  includes: IncludeEdge[];
  routes: ParsedRoute[];
}

export function scanFastApiRoutes(workspaceRoot: string, sourcePaths?: string[]): Endpoint[] {
  const files = findPythonFilesForScan(workspaceRoot, sourcePaths);
  const analyses: FileAnalysis[] = [];

  for (const filePath of files) {
    const analysis = analyzeFile(workspaceRoot, filePath);
    if (analysis) {
      analyses.push(analysis);
    }
  }

  const endpoints: Endpoint[] = [];
  for (const analysis of analyses) {
    endpoints.push(...flattenRoutes(analysis));
  }

  return dedupeEndpoints(endpoints).sort((a, b) => {
    const collectionCmp = a.collectionName.localeCompare(b.collectionName);
    if (collectionCmp !== 0) {
      return collectionCmp;
    }
    const pathCmp = a.path.localeCompare(b.path);
    if (pathCmp !== 0) {
      return pathCmp;
    }
    return a.method.localeCompare(b.method);
  });
}

function findPythonFilesForScan(workspaceRoot: string, sourcePaths?: string[]): string[] {
  const roots = sourcePaths?.length ? sourcePaths : [workspaceRoot];
  const files: string[] = [];

  for (const root of roots) {
    if (!fs.existsSync(root)) {
      continue;
    }
    walkDir(root, files);
  }

  return files;
}

function walkDir(dir: string, files: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) {
        continue;
      }
      walkDir(full, files);
      continue;
    }

    if (path.extname(entry.name).toLowerCase() === '.py') {
      files.push(full);
    }
  }
}

function analyzeFile(workspaceRoot: string, absolutePath: string): FileAnalysis | undefined {
  const content = fs.readFileSync(absolutePath, 'utf-8');
  if (!/\bfastapi\b/.test(content) && !/@\w+\.(get|post|put|delete|patch)\s*\(/.test(content)) {
    return undefined;
  }

  const relativePath = path.relative(workspaceRoot, absolutePath).replace(/\\/g, '/');
  const controllerName = path.basename(absolutePath, '.py');
  const collectionName = toCollectionName(controllerName);

  const analysis: FileAnalysis = {
    absolutePath,
    relativePath,
    apps: new Set<string>(),
    routers: new Set<string>(),
    routerPrefixes: new Map<string, string>(),
    includes: [],
    routes: [],
  };

  collectApps(content, analysis);
  collectRouters(content, analysis);
  collectIncludes(content, analysis);
  collectRoutes(content, analysis, controllerName, collectionName, absolutePath);

  if (!analysis.routes.length) {
    return undefined;
  }

  return analysis;
}

function collectApps(content: string, analysis: FileAnalysis): void {
  const regex = /^\s*(\w+)\s*=\s*FastAPI\s*\(/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    analysis.apps.add(match[1]);
  }
}

function collectRouters(content: string, analysis: FileAnalysis): void {
  const regex = /^\s*(\w+)\s*=\s*APIRouter\s*\(([^)]*)\)/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const routerVar = match[1];
    analysis.routers.add(routerVar);
    const prefix = extractPrefixArg(match[2]);
    if (prefix) {
      analysis.routerPrefixes.set(routerVar, prefix);
    }
  }
}

function collectIncludes(content: string, analysis: FileAnalysis): void {
  const regex = /(\w+)\.include_router\s*\(\s*(\w+)\b([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const appVar = match[1];
    const routerVar = match[2];
    const prefix = extractPrefixArg(match[3]) ?? '';
    if (analysis.apps.has(appVar) || analysis.routers.has(appVar)) {
      analysis.includes.push({ appVar, routerVar, prefix });
    }
  }
}

function collectRoutes(
  content: string,
  analysis: FileAnalysis,
  controllerName: string,
  collectionName: string,
  filePath: string
): void {
  const regex = /^@(\w+)\.(get|post|put|delete|patch)\(\s*(["'])([^"']+)\3([^)]*)\)/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const receiverVar = match[1];
    const methodName = match[2];
    if (!ROUTE_METHODS.has(methodName)) {
      continue;
    }
    if (!analysis.apps.has(receiverVar) && !analysis.routers.has(receiverVar)) {
      continue;
    }

    const trailingArgs = match[5] ?? '';
    const summary = trailingArgs.match(/summary\s*=\s*(["'])([^"']+)\1/)?.[2];
    const operationId = trailingArgs.match(/operation_id\s*=\s*(["'])([^"']+)\1/)?.[2];

    const line = content.slice(0, match.index).split('\n').length;
    analysis.routes.push({
      receiverVar,
      method: HTTP_METHOD_MAP[methodName],
      path: normalizePath(match[4]),
      line,
      filePath,
      controllerName,
      collectionName,
      summary,
      operationId,
    });
  }
}

function flattenRoutes(analysis: FileAnalysis): Endpoint[] {
  const endpoints: Endpoint[] = [];
  const prefixMemo = new Map<string, string[]>();

  for (const route of analysis.routes) {
    const prefixes = resolveRoutePrefixes(analysis, route.receiverVar, prefixMemo, new Set());
    for (const prefix of prefixes) {
      const fullPath = joinPaths(prefix, route.path);
      endpoints.push({
        id: `${route.controllerName}:${route.method}:${fullPath}`,
        method: route.method,
        path: fullPath,
        controllerName: route.controllerName,
        collectionName: route.collectionName,
        filePath: route.filePath,
        line: route.line,
        summary: route.summary,
        operationId: route.operationId,
      });
    }
  }

  return endpoints;
}

function resolveRoutePrefixes(
  analysis: FileAnalysis,
  receiverVar: string,
  memo: Map<string, string[]>,
  stack: Set<string>
): string[] {
  if (memo.has(receiverVar)) {
    return memo.get(receiverVar)!;
  }
  if (stack.has(receiverVar)) {
    return [''];
  }
  stack.add(receiverVar);

  if (analysis.apps.has(receiverVar)) {
    stack.delete(receiverVar);
    memo.set(receiverVar, ['']);
    return [''];
  }

  const routerPrefix = analysis.routerPrefixes.get(receiverVar) ?? '';
  const incoming = analysis.includes.filter((edge) => edge.routerVar === receiverVar);

  if (!incoming.length) {
    const prefixes = routerPrefix ? [normalizePath(routerPrefix)] : [''];
    stack.delete(receiverVar);
    memo.set(receiverVar, prefixes);
    return prefixes;
  }

  const prefixes: string[] = [];
  for (const edge of incoming) {
    const parentPrefixes = resolveRoutePrefixes(analysis, edge.appVar, memo, stack);
    for (const parentPrefix of parentPrefixes) {
      prefixes.push(joinPaths(parentPrefix, edge.prefix, routerPrefix));
    }
  }

  stack.delete(receiverVar);
  memo.set(receiverVar, prefixes);
  return prefixes;
}

function extractPrefixArg(args: string): string | undefined {
  const match = args.match(/prefix\s*=\s*(["'])([^"']+)\1/);
  return match ? match[2] : undefined;
}

function toCollectionName(fileBase: string): string {
  if (!fileBase) {
    return 'Routes';
  }
  return fileBase.charAt(0).toUpperCase() + fileBase.slice(1);
}

function normalizePath(routePath: string): string {
  if (!routePath) {
    return '/';
  }
  let normalized = routePath.trim();
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }
  return normalized.replace(/\/+/g, '/');
}

function joinPaths(...parts: string[]): string {
  const segments = parts
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^\/+|\/+$/g, ''));
  if (!segments.length) {
    return '/';
  }
  return normalizePath(`/${segments.join('/')}`);
}

function dedupeEndpoints(endpoints: Endpoint[]): Endpoint[] {
  const seen = new Set<string>();
  return endpoints.filter((endpoint) => {
    const key = `${endpoint.controllerName}:${endpoint.method}:${endpoint.path}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export { findPythonFilesForScan };

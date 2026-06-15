import * as acorn from 'acorn';
import * as fs from 'fs';
import * as path from 'path';
import { Endpoint, HttpMethod } from '../core/types';

const ROUTE_METHODS = new Set([
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'head',
  'options',
]);

const HTTP_METHOD_MAP: Record<string, HttpMethod> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  delete: 'DELETE',
  patch: 'PATCH',
  head: 'HEAD',
  options: 'OPTIONS',
};

const JS_EXTENSIONS = ['.js', '.mjs', '.cjs'];

interface MountEdge {
  parentId: string;
  childId: string;
  prefix: string;
}

interface PendingMount {
  parentVar: string;
  childVar?: string;
  childRequirePath?: string;
  prefix: string;
}

interface ParsedRoute {
  receiverId: string;
  method: HttpMethod;
  path: string;
  line: number;
  filePath: string;
  controllerName: string;
  collectionName: string;
}

interface FileAnalysis {
  absolutePath: string;
  relativePath: string;
  expressBindings: Set<string>;
  apps: Set<string>;
  routers: Set<string>;
  varToReceiverId: Map<string, string>;
  requireAliases: Map<string, string>;
  exportReceiverId?: string;
  routes: ParsedRoute[];
  pendingMounts: PendingMount[];
}

type AcornNode = acorn.Node & Record<string, unknown>;

export function scanExpressRoutes(workspaceRoot: string, sourcePaths?: string[]): Endpoint[] {
  const files = findJavaScriptFiles(workspaceRoot, sourcePaths);
  const analyses = new Map<string, FileAnalysis>();

  for (const filePath of files) {
    const analysis = analyzeFile(workspaceRoot, filePath);
    if (analysis) {
      analyses.set(filePath, analysis);
    }
  }

  linkRequireAliases(analyses);
  const mountEdges = collectMountEdges(analyses);
  const routes = flattenRoutes(analyses, mountEdges);
  return dedupeEndpoints(routes);
}

function findJavaScriptFiles(workspaceRoot: string, sourcePaths?: string[]): string[] {
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

    const ext = path.extname(entry.name).toLowerCase();
    if (JS_EXTENSIONS.includes(ext)) {
      files.push(full);
    }
  }
}

function shouldSkipDir(name: string): boolean {
  return (
    name === 'node_modules' ||
    name === '.git' ||
    name === 'dist' ||
    name === 'build' ||
    name === 'coverage' ||
    name === '.apiscope'
  );
}

function analyzeFile(workspaceRoot: string, absolutePath: string): FileAnalysis | undefined {
  const content = fs.readFileSync(absolutePath, 'utf-8');
  if (!/\bexpress\b/.test(content)) {
    return undefined;
  }

  let program: acorn.Program;
  try {
    program = parseSource(content);
  } catch {
    return undefined;
  }

  const relativePath = path.relative(workspaceRoot, absolutePath).replace(/\\/g, '/');
  const controllerName = path.basename(absolutePath, path.extname(absolutePath));
  const collectionName = toCollectionName(controllerName);

  const analysis: FileAnalysis = {
    absolutePath,
    relativePath,
    expressBindings: new Set<string>(),
    apps: new Set<string>(),
    routers: new Set<string>(),
    varToReceiverId: new Map<string, string>(),
    requireAliases: new Map<string, string>(),
    routes: [],
    pendingMounts: [],
  };

  walkNode(program as AcornNode, null, (node, parent) => {
    collectExpressBinding(node, analysis);
    collectReceiverDeclaration(node, analysis);
    collectRequireAlias(node, analysis, absolutePath);
    collectExportReceiver(node, analysis);
    collectMount(node, analysis);
    collectRoute(node, analysis, controllerName, collectionName, absolutePath);
    void parent;
  });

  return analysis;
}

function parseSource(content: string): acorn.Program {
  try {
    return acorn.parse(content, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      allowReturnOutsideFunction: true,
      locations: true,
    });
  } catch {
    return acorn.parse(content, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      allowReturnOutsideFunction: true,
      locations: true,
    });
  }
}

function walkNode(node: AcornNode, parent: AcornNode | null, visitor: (node: AcornNode, parent: AcornNode | null) => void): void {
  visitor(node, parent);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'range') {
      continue;
    }
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof (child as AcornNode).type === 'string') {
          walkNode(child as AcornNode, node, visitor);
        }
      }
    } else if (value && typeof (value as AcornNode).type === 'string') {
      walkNode(value as AcornNode, node, visitor);
    }
  }
}

function collectExpressBinding(node: AcornNode, analysis: FileAnalysis): void {
  if (node.type === 'ImportDeclaration') {
    const source = getStringLiteral(node.source as AcornNode);
    if (source !== 'express') {
      return;
    }
    for (const spec of (node.specifiers as AcornNode[]) ?? []) {
      if (spec.type === 'ImportDefaultSpecifier' || spec.type === 'ImportNamespaceSpecifier') {
        const local = getIdentifierName(spec.local as AcornNode);
        if (local) {
          analysis.expressBindings.add(local);
        }
      }
    }
    return;
  }

  if (node.type !== 'VariableDeclarator') {
    return;
  }

  const init = node.init as AcornNode | undefined;
  if (!init || init.type !== 'CallExpression') {
    return;
  }

  if (isRequireExpressCall(init)) {
    const name = getIdentifierName(node.id as AcornNode);
    if (name) {
      analysis.expressBindings.add(name);
    }
  }
}

function collectReceiverDeclaration(node: AcornNode, analysis: FileAnalysis): void {
  if (node.type !== 'VariableDeclarator') {
    return;
  }

  const name = getIdentifierName(node.id as AcornNode);
  const init = node.init as AcornNode | undefined;
  if (!name || !init) {
    return;
  }

  if (init.type === 'CallExpression' && isExpressAppCall(init, analysis.expressBindings)) {
    analysis.apps.add(name);
    analysis.varToReceiverId.set(name, receiverId(analysis.relativePath, name));
    return;
  }

  if (init.type === 'CallExpression' && isExpressRouterCall(init, analysis.expressBindings)) {
    analysis.routers.add(name);
    analysis.varToReceiverId.set(name, receiverId(analysis.relativePath, name));
    return;
  }

  if (
    init.type === 'CallExpression' &&
    (init.callee as AcornNode)?.type === 'CallExpression' &&
    isRequireExpressCall(init.callee as AcornNode)
  ) {
    analysis.apps.add(name);
    analysis.varToReceiverId.set(name, receiverId(analysis.relativePath, name));
    return;
  }

  if (init.type === 'CallExpression' && isRequireCall(init)) {
    const requiredPath = resolveRequirePath(analysis.absolutePath, getRequirePath(init));
    if (requiredPath) {
      analysis.requireAliases.set(name, requiredPath);
    }
  }
}

function collectRequireAlias(node: AcornNode, analysis: FileAnalysis, absolutePath: string): void {
  if (node.type !== 'VariableDeclarator') {
    return;
  }
  const name = getIdentifierName(node.id as AcornNode);
  const init = node.init as AcornNode | undefined;
  if (!name || !init || init.type !== 'CallExpression' || !isRequireCall(init)) {
    return;
  }
  const requiredPath = resolveRequirePath(absolutePath, getRequirePath(init));
  if (requiredPath) {
    analysis.requireAliases.set(name, requiredPath);
  }
}

function collectExportReceiver(node: AcornNode, analysis: FileAnalysis): void {
  if (node.type === 'AssignmentExpression' && node.operator === '=') {
    const left = node.left as AcornNode;
    const right = node.right as AcornNode;
    if (
      left.type === 'MemberExpression' &&
      getIdentifierName(left.object as AcornNode) === 'module' &&
      getIdentifierName(left.property as AcornNode) === 'exports'
    ) {
      analysis.exportReceiverId = resolveLocalReceiverReference(analysis, right);
    }
    return;
  }

  if (node.type === 'ExportDefaultDeclaration') {
    analysis.exportReceiverId = resolveLocalReceiverReference(
      analysis,
      node.declaration as AcornNode
    );
  }
}

function collectMount(node: AcornNode, analysis: FileAnalysis): void {
  if (node.type !== 'CallExpression' || !isMemberCall(node)) {
    return;
  }

  const callee = node.callee as AcornNode;
  const property = getIdentifierName(callee.property as AcornNode);
  if (property !== 'use') {
    return;
  }

  const parentVar = getIdentifierName(callee.object as AcornNode);
  if (!parentVar || (!analysis.apps.has(parentVar) && !analysis.routers.has(parentVar))) {
    return;
  }

  const args = (node.arguments as AcornNode[]) ?? [];
  if (args.length === 0) {
    return;
  }

  if (args.length === 1) {
    const childVar = getIdentifierName(args[0]);
    if (childVar && analysis.routers.has(childVar)) {
      analysis.pendingMounts.push({ parentVar, childVar, prefix: '' });
    }
    return;
  }

  const prefix = extractMountPrefix(args[0]) ?? '';
  const targetArg = args[1];

  const childVar = getIdentifierName(targetArg);
  if (childVar && (analysis.routers.has(childVar) || analysis.requireAliases.has(childVar))) {
    analysis.pendingMounts.push({ parentVar, childVar, prefix });
    return;
  }

  if (targetArg.type === 'CallExpression' && isRequireCall(targetArg)) {
    const requiredPath = resolveRequirePath(analysis.absolutePath, getRequirePath(targetArg));
    if (requiredPath) {
      analysis.pendingMounts.push({
        parentVar,
        childRequirePath: requiredPath,
        prefix,
      });
    }
  }
}

function collectRoute(
  node: AcornNode,
  analysis: FileAnalysis,
  controllerName: string,
  collectionName: string,
  filePath: string
): void {
  if (node.type !== 'CallExpression' || !isMemberCall(node)) {
    return;
  }

  const callee = node.callee as AcornNode;
  const methodName = getIdentifierName(callee.property as AcornNode);
  if (!methodName || !ROUTE_METHODS.has(methodName)) {
    return;
  }

  const receiverName = getIdentifierName(callee.object as AcornNode);
  if (!receiverName) {
    return;
  }

  if (!analysis.apps.has(receiverName) && !analysis.routers.has(receiverName)) {
    return;
  }

  const args = (node.arguments as AcornNode[]) ?? [];
  if (!args.length) {
    return;
  }

  const routePath = extractRoutePath(args[0]);
  if (routePath === undefined) {
    return;
  }

  const receiverIdValue = analysis.varToReceiverId.get(receiverName);
  if (!receiverIdValue) {
    return;
  }

  analysis.routes.push({
    receiverId: receiverIdValue,
    method: HTTP_METHOD_MAP[methodName],
    path: normalizePath(routePath),
    line: node.loc?.start.line,
    filePath,
    controllerName,
    collectionName,
  });
}

function linkRequireAliases(analyses: Map<string, FileAnalysis>): void {
  for (const analysis of analyses.values()) {
    for (const [alias, requiredPath] of analysis.requireAliases.entries()) {
      const target = analyses.get(requiredPath);
      if (!target?.exportReceiverId) {
        continue;
      }
      analysis.varToReceiverId.set(alias, target.exportReceiverId);
      analysis.routers.add(alias);
    }
  }
}

function collectMountEdges(analyses: Map<string, FileAnalysis>): MountEdge[] {
  const edges: MountEdge[] = [];

  for (const analysis of analyses.values()) {
    for (const pending of analysis.pendingMounts) {
      const parentId = analysis.varToReceiverId.get(pending.parentVar);
      if (!parentId) {
        continue;
      }

      let childId: string | undefined;
      if (pending.childVar) {
        childId = analysis.varToReceiverId.get(pending.childVar);
      } else if (pending.childRequirePath) {
        childId = analyses.get(pending.childRequirePath)?.exportReceiverId;
      }

      if (childId && childId !== parentId) {
        edges.push({ parentId, childId, prefix: pending.prefix });
      }
    }
  }

  return edges;
}

function flattenRoutes(analyses: Map<string, FileAnalysis>, mountEdges: MountEdge[]): Endpoint[] {
  const appIds = new Set<string>();
  const routes: ParsedRoute[] = [];

  for (const analysis of analyses.values()) {
    for (const appName of analysis.apps) {
      appIds.add(receiverId(analysis.relativePath, appName));
    }
    routes.push(...analysis.routes);
  }

  const prefixMemo = new Map<string, string[]>();
  const endpoints: Endpoint[] = [];

  for (const route of routes) {
    const prefixes = resolvePrefixes(route.receiverId, mountEdges, appIds, prefixMemo, new Set());
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
      });
    }
  }

  return endpoints.sort((a, b) => {
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

function resolvePrefixes(
  receiverId: string,
  mountEdges: MountEdge[],
  appIds: Set<string>,
  memo: Map<string, string[]>,
  stack: Set<string>
): string[] {
  if (appIds.has(receiverId)) {
    return [''];
  }

  if (memo.has(receiverId)) {
    return memo.get(receiverId)!;
  }

  if (stack.has(receiverId)) {
    return [''];
  }
  stack.add(receiverId);

  const incoming = mountEdges.filter((edge) => edge.childId === receiverId);
  if (!incoming.length) {
    stack.delete(receiverId);
    memo.set(receiverId, ['']);
    return [''];
  }

  const prefixes: string[] = [];
  for (const edge of incoming) {
    const parentPrefixes = resolvePrefixes(edge.parentId, mountEdges, appIds, memo, stack);
    for (const parentPrefix of parentPrefixes) {
      prefixes.push(joinPaths(parentPrefix, edge.prefix));
    }
  }

  stack.delete(receiverId);
  memo.set(receiverId, prefixes);
  return prefixes;
}

function resolveLocalReceiverReference(analysis: FileAnalysis, node: AcornNode): string | undefined {
  if (node.type === 'Identifier') {
    return analysis.varToReceiverId.get(node.name as string);
  }
  return undefined;
}

function extractMountPrefix(node: AcornNode): string | undefined {
  const routePath = extractRoutePath(node);
  return routePath === undefined ? undefined : normalizePath(routePath);
}

function extractRoutePath(node: AcornNode): string | undefined {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }

  if (node.type === 'TemplateLiteral' && (node.expressions as AcornNode[]).length === 0) {
    const quasis = node.quasis as AcornNode[];
    return quasis.map((part) => String(part.value?.cooked ?? '')).join('');
  }

  return undefined;
}

function isMemberCall(node: AcornNode): boolean {
  const callee = node.callee as AcornNode | undefined;
  return callee?.type === 'MemberExpression';
}

function isRequireExpressCall(node: AcornNode): boolean {
  return isRequireCall(node) && getRequirePath(node) === 'express';
}

function isRequireCall(node: AcornNode): boolean {
  const callee = node.callee as AcornNode | undefined;
  return (
    node.type === 'CallExpression' &&
    callee?.type === 'Identifier' &&
    (callee.name as string) === 'require' &&
    (node.arguments as AcornNode[]).length === 1
  );
}

function getRequirePath(node: AcornNode): string | undefined {
  const arg = (node.arguments as AcornNode[])?.[0];
  return arg ? getStringLiteral(arg) : undefined;
}

function isExpressAppCall(node: AcornNode, expressBindings: Set<string>): boolean {
  const callee = node.callee as AcornNode | undefined;
  return callee?.type === 'Identifier' && expressBindings.has(callee.name as string);
}

function isExpressRouterCall(node: AcornNode, expressBindings: Set<string>): boolean {
  const callee = node.callee as AcornNode | undefined;
  if (callee?.type !== 'MemberExpression') {
    return false;
  }
  const objectName = getIdentifierName(callee.object as AcornNode);
  const propertyName = getIdentifierName(callee.property as AcornNode);
  return objectName !== undefined && expressBindings.has(objectName) && propertyName === 'Router';
}

function getIdentifierName(node: AcornNode | undefined): string | undefined {
  if (!node) {
    return undefined;
  }
  if (node.type === 'Identifier') {
    return node.name as string;
  }
  return undefined;
}

function getStringLiteral(node: AcornNode | undefined): string | undefined {
  if (!node || node.type !== 'Literal' || typeof node.value !== 'string') {
    return undefined;
  }
  return node.value;
}

function resolveRequirePath(fromFile: string, requestPath: string | undefined): string | undefined {
  if (!requestPath || !requestPath.startsWith('.')) {
    return undefined;
  }

  const base = path.resolve(path.dirname(fromFile), requestPath);
  const candidates = [
    base,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.cjs`,
    path.join(base, 'index.js'),
    path.join(base, 'index.mjs'),
    path.join(base, 'index.cjs'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return undefined;
}

function receiverId(relativePath: string, name: string): string {
  return `${relativePath}#${name}`;
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

function joinPaths(prefix: string, routePath: string): string {
  const left = prefix || '';
  const right = routePath || '/';
  if (!left) {
    return normalizePath(right);
  }
  if (right === '/') {
    return normalizePath(left);
  }
  return normalizePath(`${left}/${right.replace(/^\//, '')}`);
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

export { findJavaScriptFiles, shouldSkipDir };

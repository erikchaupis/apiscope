import * as acorn from 'acorn';

const BLOCKED_CALLEES = new Set([
  'fetch',
  'eval',
  'require',
  'import',
  'setTimeout',
  'setInterval',
  'Function',
  'XMLHttpRequest',
  'WebSocket',
]);

const BLOCKED_NEW_CALLEES = new Set(['Function', 'XMLHttpRequest', 'WebSocket']);

type AcornNode = acorn.Node & Record<string, unknown>;

function walk(node: AcornNode, visit: (node: AcornNode) => void): void {
  if (!node || typeof node !== 'object') {
    return;
  }
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child === 'object' && 'type' in (child as object)) {
          walk(child as AcornNode, visit);
        }
      }
    } else if (value && typeof value === 'object' && 'type' in (value as object)) {
      walk(value as AcornNode, visit);
    }
  }
}

export function validateScriptSource(source: string): string | null {
  if (!source.trim()) {
    return null;
  }
  let ast: AcornNode;
  try {
    ast = acorn.parse(source, {
      ecmaVersion: 2020,
      sourceType: 'script',
    }) as AcornNode;
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid script syntax.';
  }

  let blocked: string | null = null;
  walk(ast, (node) => {
    if (blocked) {
      return;
    }
    switch (node.type) {
      case 'ImportDeclaration':
      case 'ExportNamedDeclaration':
      case 'ExportAllDeclaration':
        blocked = 'import and export are not allowed in scripts.';
        return;
      case 'ImportExpression':
        blocked = 'dynamic import is not allowed in scripts.';
        return;
      case 'CallExpression': {
        const callee = node.callee as AcornNode;
        if (callee.type === 'Identifier' && BLOCKED_CALLEES.has(callee.name as string)) {
          blocked = `${callee.name as string}() is not allowed in scripts.`;
        }
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          (callee.object as AcornNode).type === 'Identifier' &&
          ((callee.object as AcornNode).name === 'global' ||
            (callee.object as AcornNode).name === 'process')
        ) {
          blocked = 'process and global access are not allowed in scripts.';
        }
        return;
      }
      case 'NewExpression': {
        const callee = node.callee as AcornNode;
        if (callee.type === 'Identifier' && BLOCKED_NEW_CALLEES.has(callee.name as string)) {
          blocked = `${callee.name as string} is not allowed in scripts.`;
        }
        return;
      }
      default:
        return;
    }
  });
  return blocked;
}

function loopBodyStart(body: AcornNode): number | null {
  if (body.type === 'BlockStatement') {
    return (body.start as number) + 1;
  }
  return body.start as number;
}

export function injectLoopGuards(source: string): string {
  if (!source.trim()) {
    return source;
  }
  const ast = acorn.parse(source, {
    ecmaVersion: 2020,
    sourceType: 'script',
  }) as AcornNode;

  const insertions: Array<{ pos: number; text: string }> = [];
  const loopTypes = new Set([
    'ForStatement',
    'WhileStatement',
    'DoWhileStatement',
    'ForInStatement',
    'ForOfStatement',
  ]);

  walk(ast, (node) => {
    if (!loopTypes.has(node.type as string)) {
      return;
    }
    const body = node.body as AcornNode;
    const start = loopBodyStart(body);
    if (start === null) {
      return;
    }
    if (body.type === 'BlockStatement') {
      insertions.push({ pos: start, text: '__loopGuard();' });
    } else {
      insertions.push({
        pos: start,
        text: '{ __loopGuard(); ',
      });
      insertions.push({
        pos: body.end as number,
        text: '}',
      });
    }
  });

  if (insertions.length === 0) {
    return source;
  }

  insertions.sort((a, b) => b.pos - a.pos);
  let result = source;
  for (const insertion of insertions) {
    result = result.slice(0, insertion.pos) + insertion.text + result.slice(insertion.pos);
  }
  return result;
}

import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_PORT = 3000;
const JS_EXTENSIONS = ['.js', '.mjs', '.cjs'];

export function detectExpressBaseUrl(workspaceRoot: string): string {
  const port = detectServerPort(workspaceRoot) ?? DEFAULT_PORT;
  return `http://localhost:${port}`;
}

function detectServerPort(workspaceRoot: string): number | undefined {
  const portConstants = new Map<string, number>();
  const listenPorts: number[] = [];

  for (const filePath of findJavaScriptFiles(workspaceRoot)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    collectPortConstants(content, portConstants);
    collectListenPorts(content, portConstants, listenPorts);
  }

  if (listenPorts.length) {
    return listenPorts[0];
  }

  const firstConstant = [...portConstants.values()][0];
  return firstConstant;
}

function collectPortConstants(content: string, portConstants: Map<string, number>): void {
  const constRegex = /\b(?:const|let|var)\s+(PORT|port)\s*=\s*(\d+)\s*;/g;
  let match: RegExpExecArray | null;
  while ((match = constRegex.exec(content)) !== null) {
    portConstants.set(match[1], parseInt(match[2], 10));
  }
}

function collectListenPorts(
  content: string,
  portConstants: Map<string, number>,
  listenPorts: number[]
): void {
  const literalRegex = /\.listen\s*\(\s*(\d+)\s*[,)]/g;
  let match: RegExpExecArray | null;
  while ((match = literalRegex.exec(content)) !== null) {
    listenPorts.push(parseInt(match[1], 10));
  }

  const identifierRegex = /\.listen\s*\(\s*(PORT|port)\s*[,)]/g;
  while ((match = identifierRegex.exec(content)) !== null) {
    const resolved = portConstants.get(match[1]);
    if (resolved !== undefined) {
      listenPorts.push(resolved);
    }
  }
}

function findJavaScriptFiles(workspaceRoot: string): string[] {
  const files: string[] = [];
  walkDir(workspaceRoot, files);
  return files;
}

function walkDir(dir: string, files: string[]): void {
  if (!fs.existsSync(dir)) {
    return;
  }

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

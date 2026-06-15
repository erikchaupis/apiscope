import * as fs from 'fs';
import * as path from 'path';
import { findPythonFiles } from './FastApiProjectDetector';

const DEFAULT_PORT = 8000;

export function detectFastApiBaseUrl(workspaceRoot: string): string {
  const port = detectServerPort(workspaceRoot) ?? DEFAULT_PORT;
  return `http://localhost:${port}`;
}

function detectServerPort(workspaceRoot: string): number | undefined {
  const portConstants = new Map<string, number>();
  const literalPorts: number[] = [];

  for (const filePath of findPythonFiles(workspaceRoot)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    collectPortConstants(content, portConstants);
    collectUvicornPorts(content, portConstants, literalPorts);
  }

  if (literalPorts.length) {
    return literalPorts[0];
  }

  const firstConstant = [...portConstants.values()][0];
  return firstConstant;
}

function collectPortConstants(content: string, portConstants: Map<string, number>): void {
  const regex = /^\s*(PORT|port)\s*=\s*(\d+)\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    portConstants.set(match[1], parseInt(match[2], 10));
  }
}

function collectUvicornPorts(
  content: string,
  portConstants: Map<string, number>,
  literalPorts: number[]
): void {
  const literalRegex = /uvicorn\.run\s*\([^)]*?\bport\s*=\s*(\d+)/g;
  let match: RegExpExecArray | null;
  while ((match = literalRegex.exec(content)) !== null) {
    literalPorts.push(parseInt(match[1], 10));
  }

  const identifierRegex = /uvicorn\.run\s*\([^)]*?\bport\s*=\s*(PORT|port)\b/g;
  while ((match = identifierRegex.exec(content)) !== null) {
    const resolved = portConstants.get(match[1]);
    if (resolved !== undefined) {
      literalPorts.push(resolved);
    }
  }
}

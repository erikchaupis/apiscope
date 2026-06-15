import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_PORT = 8080;

export function detectBaseUrl(workspaceRoot: string): string {
  const port = detectServerPort(workspaceRoot) ?? DEFAULT_PORT;
  const contextPath = detectContextPath(workspaceRoot) ?? '';
  const normalizedContext = contextPath ? `/${contextPath.replace(/^\/+|\/+$/g, '')}` : '';
  return `http://localhost:${port}${normalizedContext}`;
}

function detectServerPort(workspaceRoot: string): number | undefined {
  const resourceDirs = [
    path.join(workspaceRoot, 'src', 'main', 'resources'),
    path.join(workspaceRoot, 'src', 'main', 'resources', 'config'),
  ];

  for (const dir of resourceDirs) {
    if (!fs.existsSync(dir)) {
      continue;
    }
    const propsPath = path.join(dir, 'application.properties');
    if (fs.existsSync(propsPath)) {
      const content = fs.readFileSync(propsPath, 'utf-8');
      const port = parsePropertiesPort(content);
      if (port !== undefined) {
        return port;
      }
    }
    for (const ymlName of ['application.yml', 'application.yaml']) {
      const ymlPath = path.join(dir, ymlName);
      if (fs.existsSync(ymlPath)) {
        const port = parseYamlPort(fs.readFileSync(ymlPath, 'utf-8'));
        if (port !== undefined) {
          return port;
        }
      }
    }
  }

  return undefined;
}

function detectContextPath(workspaceRoot: string): string | undefined {
  const resourceDirs = [
    path.join(workspaceRoot, 'src', 'main', 'resources'),
    path.join(workspaceRoot, 'src', 'main', 'resources', 'config'),
  ];

  for (const dir of resourceDirs) {
    if (!fs.existsSync(dir)) {
      continue;
    }
    const propsPath = path.join(dir, 'application.properties');
    if (fs.existsSync(propsPath)) {
      const contextPath = parsePropertiesContextPath(fs.readFileSync(propsPath, 'utf-8'));
      if (contextPath !== undefined) {
        return contextPath;
      }
    }
    for (const ymlName of ['application.yml', 'application.yaml']) {
      const ymlPath = path.join(dir, ymlName);
      if (fs.existsSync(ymlPath)) {
        const contextPath = parseYamlContextPath(fs.readFileSync(ymlPath, 'utf-8'));
        if (contextPath !== undefined) {
          return contextPath;
        }
      }
    }
  }

  return undefined;
}

function parsePropertiesPort(content: string): number | undefined {
  const match = content.match(/^\s*server\.port\s*=\s*(\d+)\s*$/m);
  if (match) {
    return parseInt(match[1], 10);
  }
  return undefined;
}

function parsePropertiesContextPath(content: string): string | undefined {
  const match = content.match(/^\s*server\.servlet\.context-path\s*=\s*(.+)\s*$/m);
  if (!match) {
    return undefined;
  }
  return match[1].trim().replace(/^['"]|['"]$/g, '');
}

function parseYamlPort(content: string): number | undefined {
  const lines = content.split('\n');
  let inServer = false;
  for (const line of lines) {
    if (/^server\s*:/.test(line)) {
      inServer = true;
      continue;
    }
    if (inServer) {
      const portMatch = line.match(/^\s+port\s*:\s*(\d+)\s*$/);
      if (portMatch) {
        return parseInt(portMatch[1], 10);
      }
      if (/^\S/.test(line) && !line.startsWith('#')) {
        inServer = false;
      }
    }
  }
  return undefined;
}

function parseYamlContextPath(content: string): string | undefined {
  const lines = content.split('\n');
  let inServer = false;
  let inServlet = false;
  for (const line of lines) {
    if (/^server\s*:/.test(line)) {
      inServer = true;
      inServlet = false;
      continue;
    }
    if (!inServer) {
      continue;
    }
    if (/^\s+servlet\s*:/.test(line)) {
      inServlet = true;
      continue;
    }
    if (inServlet) {
      const match = line.match(/^\s+context-path\s*:\s*(.+)\s*$/);
      if (match) {
        return match[1].trim().replace(/^['"]|['"]$/g, '');
      }
      if (/^\s+\S/.test(line) && !/^\s+context-path/.test(line)) {
        inServlet = false;
      }
    }
    if (/^\S/.test(line) && !line.startsWith('#')) {
      inServer = false;
      inServlet = false;
    }
  }
  return undefined;
}

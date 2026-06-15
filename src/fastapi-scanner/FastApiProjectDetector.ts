import * as fs from 'fs';
import * as path from 'path';

export interface FastApiProjectInfo {
  detected: boolean;
  label: string;
}

export async function detectFastApiProject(workspaceRoot: string): Promise<FastApiProjectInfo> {
  if (hasFastApiDependency(workspaceRoot)) {
    return { detected: true, label: 'Python / FastAPI' };
  }

  if (hasFastApiImportInSource(workspaceRoot)) {
    return { detected: true, label: 'Python / FastAPI' };
  }

  return { detected: false, label: '' };
}

function hasFastApiDependency(workspaceRoot: string): boolean {
  const requirementsPath = path.join(workspaceRoot, 'requirements.txt');
  if (fs.existsSync(requirementsPath)) {
    const content = fs.readFileSync(requirementsPath, 'utf-8');
    if (/^\s*fastapi(?:[<=[\s]|$)/im.test(content)) {
      return true;
    }
  }

  for (const fileName of ['pyproject.toml', 'Pipfile']) {
    const filePath = path.join(workspaceRoot, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    if (/\bfastapi\b/i.test(content)) {
      return true;
    }
  }

  return false;
}

function hasFastApiImportInSource(workspaceRoot: string): boolean {
  for (const filePath of findPythonFiles(workspaceRoot)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (/\bfrom\s+fastapi\s+import\b/.test(content) || /\bimport\s+fastapi\b/.test(content)) {
      return true;
    }
  }
  return false;
}

function findPythonFiles(workspaceRoot: string): string[] {
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

    if (path.extname(entry.name).toLowerCase() === '.py') {
      files.push(full);
    }
  }
}

function shouldSkipDir(name: string): boolean {
  return (
    name === '__pycache__' ||
    name === '.venv' ||
    name === 'venv' ||
    name === '.git' ||
    name === 'node_modules' ||
    name === 'dist' ||
    name === 'build' ||
    name === '.apiscope' ||
    name === '.mypy_cache' ||
    name === '.pytest_cache'
  );
}

export { shouldSkipDir, findPythonFiles };

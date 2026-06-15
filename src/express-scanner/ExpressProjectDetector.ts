import * as fs from 'fs';
import * as path from 'path';

export interface ExpressProjectInfo {
  detected: boolean;
  label: string;
}

export async function detectExpressProject(workspaceRoot: string): Promise<ExpressProjectInfo> {
  const pkgPath = path.join(workspaceRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return { detected: false, label: '' };
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.express) {
      return { detected: true, label: 'Node.js / Express' };
    }
  } catch {
    return { detected: false, label: '' };
  }

  return { detected: false, label: '' };
}

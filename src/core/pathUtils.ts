import * as path from 'path';

/** Convert an absolute path to a workspace-relative path using forward slashes. */
export function toRelativePath(workspaceRoot: string, absolutePath: string): string {
  const rel = path.relative(workspaceRoot, absolutePath);
  if (rel.startsWith('..')) {
    return absolutePath.split(path.sep).join('/');
  }
  return rel.split(path.sep).join('/');
}

/** Resolve a workspace-relative source file path to an absolute path. */
export function resolveSourcePath(workspaceRoot: string, sourceFile: string): string {
  return path.normalize(path.join(workspaceRoot, sourceFile));
}

/** Normalize legacy absolute paths to relative when possible. */
export function normalizeSourceFile(
  workspaceRoot: string,
  sourceFile?: string,
  legacyFilePath?: string
): string | undefined {
  if (sourceFile) {
    if (path.isAbsolute(sourceFile)) {
      return toRelativePath(workspaceRoot, sourceFile);
    }
    return sourceFile.split(path.sep).join('/');
  }
  if (legacyFilePath) {
    return toRelativePath(workspaceRoot, legacyFilePath);
  }
  return undefined;
}

import * as path from 'path';

/** File extensions that may change scanned API routes when saved. */
export const SCANNABLE_SOURCE_EXTENSIONS = new Set([
  '.java',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.py',
]);

export function isScannableSourceFile(filePath: string): boolean {
  return SCANNABLE_SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

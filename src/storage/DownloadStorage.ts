import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { dayPathFromTimestamp } from '../core/historyTypes';
import {
  ensureFileExtension,
  FileResponseMetadata,
  resolveDownloadFileName,
} from '../core/fileResponse';
import { APISCOPE_DIR, getApiscopeDir } from './ApiScopeStorage';

export const DOWNLOADS_DIR = 'downloads';
export const EPHEMERAL_DOWNLOADS_DIR = '.temp';

const COUNTER_FILE = '.counter.json';
const EPHEMERAL_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readCounter(file: string): number {
  try {
    if (!fs.existsSync(file)) {
      return 0;
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as { lastId?: number };
    return typeof data.lastId === 'number' ? data.lastId : 0;
  } catch {
    return 0;
  }
}

function writeCounter(file: string, lastId: number): void {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify({ lastId }, null, 2) + '\n', 'utf-8');
}

export function downloadsRoot(workspaceRoot: string): string {
  return path.join(getApiscopeDir(workspaceRoot), DOWNLOADS_DIR);
}

export function downloadsDayDir(workspaceRoot: string, dayPath: string): string {
  return path.join(downloadsRoot(workspaceRoot), dayPath);
}

export function ephemeralDownloadsDir(workspaceRoot: string): string {
  return path.join(downloadsRoot(workspaceRoot), EPHEMERAL_DOWNLOADS_DIR);
}

export function relativeEphemeralDownloadPath(storedFileName: string): string {
  return path
    .join(APISCOPE_DIR, DOWNLOADS_DIR, EPHEMERAL_DOWNLOADS_DIR, storedFileName)
    .replace(/\\/g, '/');
}

export function relativeDownloadPath(dayPath: string, storedFileName: string): string {
  return path.join(APISCOPE_DIR, DOWNLOADS_DIR, dayPath, storedFileName).replace(/\\/g, '/');
}

export function absoluteDownloadPath(workspaceRoot: string, downloadPath: string): string {
  return path.join(workspaceRoot, downloadPath);
}

export function downloadFileExists(workspaceRoot: string, downloadPath: string): boolean {
  try {
    const abs = absoluteDownloadPath(workspaceRoot, downloadPath);
    return fs.existsSync(abs) && fs.statSync(abs).isFile();
  } catch {
    return false;
  }
}

function allocateStoredFileName(
  workspaceRoot: string,
  dayPath: string,
  preferredFileName: string,
  contentType: string | undefined
): { storedFileName: string; absolutePath: string; relativePath: string } {
  const dayDir = downloadsDayDir(workspaceRoot, dayPath);
  ensureDir(dayDir);

  const counterPath = path.join(dayDir, COUNTER_FILE);
  const nextId = readCounter(counterPath) + 1;
  writeCounter(counterPath, nextId);

  const resolvedName = ensureFileExtension(preferredFileName, contentType);
  const ext = path.extname(resolvedName) || '.bin';
  const storedFileName = `download-${String(nextId).padStart(3, '0')}${ext}`;
  const absolutePath = path.join(dayDir, storedFileName);
  const relativePath = relativeDownloadPath(dayPath, storedFileName);

  return { storedFileName, absolutePath, relativePath };
}

export interface SaveDownloadInput {
  workspaceRoot: string;
  headers: Record<string, string>;
  requestUrl: string;
  timestamp?: string;
  /** When false, file is stored under `.temp/` for the current session only. */
  persist?: boolean;
}

function allocateEphemeralFileName(
  workspaceRoot: string,
  preferredFileName: string,
  contentType: string | undefined
): { storedFileName: string; absolutePath: string; relativePath: string } {
  const tempDir = ephemeralDownloadsDir(workspaceRoot);
  ensureDir(tempDir);

  const resolvedName = ensureFileExtension(preferredFileName, contentType);
  const ext = path.extname(resolvedName) || '.bin';
  const storedFileName = `${randomUUID()}${ext}`;
  const absolutePath = path.join(tempDir, storedFileName);
  const relativePath = relativeEphemeralDownloadPath(storedFileName);

  return { storedFileName, absolutePath, relativePath };
}

export function cleanupEphemeralDownloads(workspaceRoot: string): void {
  const tempDir = ephemeralDownloadsDir(workspaceRoot);
  if (!fs.existsSync(tempDir)) {
    return;
  }

  const cutoff = Date.now() - EPHEMERAL_MAX_AGE_MS;
  for (const entry of fs.readdirSync(tempDir)) {
    const absolutePath = path.join(tempDir, entry);
    try {
      const stat = fs.statSync(absolutePath);
      if (stat.isFile() && stat.mtimeMs < cutoff) {
        fs.unlinkSync(absolutePath);
      }
    } catch {
      // ignore stale or unreadable files
    }
  }
}

export function createDownloadWriteStream(input: SaveDownloadInput): {
  stream: fs.WriteStream;
  displayFileName: string;
  contentType: string;
  finalize: () => FileResponseMetadata;
} {
  const dayPath = dayPathFromTimestamp(input.timestamp ?? new Date().toISOString());
  const displayFileName = resolveDownloadFileName(input.headers, input.requestUrl);
  const contentType =
    Object.entries(input.headers).find(([key]) => key.toLowerCase() === 'content-type')?.[1] ??
    'application/octet-stream';
  const normalizedContentType = contentType.split(';')[0]?.trim() ?? 'application/octet-stream';
  const persist = input.persist !== false;

  const { absolutePath, relativePath } = persist
    ? allocateStoredFileName(input.workspaceRoot, dayPath, displayFileName, contentType)
    : allocateEphemeralFileName(input.workspaceRoot, displayFileName, contentType);

  const stream = fs.createWriteStream(absolutePath);

  return {
    stream,
    displayFileName,
    contentType: normalizedContentType,
    finalize: () => {
      const size = fs.statSync(absolutePath).size;
      return {
        stored: persist,
        ephemeral: !persist,
        fileName: displayFileName,
        contentType: normalizedContentType,
        size,
        downloadPath: relativePath,
      };
    },
  };
}

export async function copyDownloadToDestination(
  workspaceRoot: string,
  downloadPath: string,
  destinationPath: string
): Promise<void> {
  const source = absoluteDownloadPath(workspaceRoot, downloadPath);
  if (!fs.existsSync(source)) {
    throw new Error('Downloaded file not found');
  }
  await fs.promises.copyFile(source, destinationPath);
}

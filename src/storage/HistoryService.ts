import * as fs from 'fs';
import * as path from 'path';
import type { ApiRequest, ApiResponse } from '../core/types';
import {
  DEFAULT_RECENT_HISTORY_DAYS,
  HISTORY_LEGACY_SPEC_VERSION,
  HISTORY_SPEC_VERSION,
  HistoryDailyIndex,
  HistoryDailySummary,
  HistoryEntry,
  HistoryGlobalIndex,
  HistoryIndexEntry,
  HistoryLegacyIndex,
  HistoryMetaFile,
  HistoryRequestFile,
  HistoryResponseFile,
  HistorySourceContext,
  dailySummaryToIndexEntry,
  dayPathFromTimestamp,
  indexEntryToDailySummary,
  isoDateFromDayPath,
  pathFromUrl,
  requestSignature,
} from '../core/historyTypes';
import { ensureApiscopeLayout, getApiscopeDir } from './ApiScopeStorage';

const HISTORY_DIR = 'history';
const LEGACY_ENTRIES_DIR = 'entries';
const GLOBAL_INDEX_FILE = 'index.json';
const DAILY_INDEX_FILE = 'index.json';
const REQUEST_FILE = 'request.json';
const RESPONSE_FILE = 'response.json';
const META_FILE = 'meta.json';

function historyResponseSnapshot(
  response: ApiResponse,
  captureResponse: boolean
): ApiResponse {
  return {
    statusCode: response.statusCode,
    statusText: response.statusText,
    headers: response.headers,
    durationMs: response.durationMs,
    body: captureResponse && !response.fileResponse ? response.body : '',
    ...(captureResponse && response.fileResponse ? { fileResponse: response.fileResponse } : {}),
  };
}

function historyResponseFileFromEntry(entry: HistoryEntry): HistoryResponseFile | undefined {
  if (!entry.response) {
    return undefined;
  }
  return {
    statusCode: entry.response.statusCode,
    statusText: entry.response.statusText,
    headers: entry.response.headers,
    durationMs: entry.response.durationMs,
    ...(entry.captureResponse && entry.response.fileResponse
      ? { fileResponse: entry.response.fileResponse }
      : entry.captureResponse && entry.response.body
        ? { body: entry.response.body }
        : {}),
  };
}

function historyRoot(workspaceRoot: string): string {
  return path.join(getApiscopeDir(workspaceRoot), HISTORY_DIR);
}

function globalIndexPath(workspaceRoot: string): string {
  return path.join(historyRoot(workspaceRoot), GLOBAL_INDEX_FILE);
}

function legacyEntriesDir(workspaceRoot: string): string {
  return path.join(historyRoot(workspaceRoot), LEGACY_ENTRIES_DIR);
}

function dayDir(workspaceRoot: string, dayPath: string): string {
  return path.join(historyRoot(workspaceRoot), dayPath);
}

function dailyIndexPath(workspaceRoot: string, dayPath: string): string {
  return path.join(dayDir(workspaceRoot, dayPath), DAILY_INDEX_FILE);
}

function entryDir(workspaceRoot: string, dayPath: string, entryId: string): string {
  return path.join(dayDir(workspaceRoot, dayPath), entryId);
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown): void {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function emptyGlobalIndex(): HistoryGlobalIndex {
  return { specVersion: HISTORY_SPEC_VERSION, days: [] };
}

function parseHistoryIdNumber(id: string): number {
  const match = id.match(/^hist-(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

function nextHistoryId(lastEntryId: string | undefined): string {
  const next = lastEntryId ? parseHistoryIdNumber(lastEntryId) + 1 : 1;
  return `hist-${String(next).padStart(3, '0')}`;
}

function isLegacyGlobalIndex(raw: unknown): raw is HistoryLegacyIndex {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    'entries' in raw &&
    Array.isArray((raw as HistoryLegacyIndex).entries)
  );
}

function isNewGlobalIndex(raw: unknown): raw is HistoryGlobalIndex {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    'days' in raw &&
    Array.isArray((raw as HistoryGlobalIndex).days)
  );
}

function ensureHistoryRoot(workspaceRoot: string): void {
  ensureApiscopeLayout(workspaceRoot);
  const root = historyRoot(workspaceRoot);
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
}

function readGlobalIndexFromDisk(workspaceRoot: string): HistoryGlobalIndex {
  const file = globalIndexPath(workspaceRoot);
  const raw = readJson<unknown>(file, emptyGlobalIndex());
  if (isNewGlobalIndex(raw)) {
    return {
      specVersion: HISTORY_SPEC_VERSION,
      days: [...raw.days],
      lastEntryId: raw.lastEntryId,
    };
  }
  return emptyGlobalIndex();
}

function writeGlobalIndex(workspaceRoot: string, index: HistoryGlobalIndex): void {
  ensureHistoryRoot(workspaceRoot);
  writeJson(globalIndexPath(workspaceRoot), index);
}

function readDailyIndexFromDisk(workspaceRoot: string, dayPath: string): HistoryDailyIndex | undefined {
  const file = dailyIndexPath(workspaceRoot, dayPath);
  if (!fs.existsSync(file)) {
    return undefined;
  }
  const raw = readJson<HistoryDailyIndex | undefined>(file, undefined);
  if (!raw || !Array.isArray(raw.entries)) {
    return undefined;
  }
  return raw;
}

function writeDailyIndex(workspaceRoot: string, dayPath: string, index: HistoryDailyIndex): void {
  writeJson(dailyIndexPath(workspaceRoot, dayPath), index);
}

function upsertDayInGlobalIndex(index: HistoryGlobalIndex, dayPath: string): void {
  index.days = index.days.filter((day) => day !== dayPath);
  index.days.unshift(dayPath);
}

function writeEntryFiles(
  workspaceRoot: string,
  dayPath: string,
  entry: HistoryEntry
): void {
  const dir = entryDir(workspaceRoot, dayPath, entry.id);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const requestFile: HistoryRequestFile = {
    method: entry.request.method,
    url: entry.request.url,
    headers: entry.request.headers,
    queryParams: entry.request.queryParams,
    body: entry.request.body,
    requestBody: entry.request.requestBody,
    resolvedUrl: entry.resolvedUrl,
  };
  writeJson(path.join(dir, REQUEST_FILE), requestFile);

  if (entry.response) {
    writeJson(path.join(dir, RESPONSE_FILE), historyResponseFileFromEntry(entry)!);
  }

  const metaFile: HistoryMetaFile = {
    timestamp: entry.timestamp,
    signature: entry.signature,
    environmentId: entry.environmentId,
    source: entry.source,
    captureResponse: entry.captureResponse,
    durationMs: entry.durationMs,
    ...(entry.error ? { error: entry.error } : {}),
  };
  writeJson(path.join(dir, META_FILE), metaFile);
}

function assembleHistoryEntry(
  entryId: string,
  requestFile: HistoryRequestFile,
  metaFile: HistoryMetaFile,
  responseFile?: HistoryResponseFile
): HistoryEntry {
  const request: ApiRequest = {
    method: requestFile.method,
    url: requestFile.url,
    headers: requestFile.headers,
    queryParams: requestFile.queryParams,
    body: requestFile.body,
    ...(requestFile.requestBody ? { requestBody: requestFile.requestBody } : {}),
  };

  let response: ApiResponse | undefined;
  if (responseFile) {
    response = {
      statusCode: responseFile.statusCode,
      statusText: responseFile.statusText,
      headers: responseFile.headers,
      body: metaFile.captureResponse ? (responseFile.body ?? '') : '',
      durationMs: responseFile.durationMs,
      ...(metaFile.captureResponse && responseFile.fileResponse
        ? { fileResponse: responseFile.fileResponse }
        : {}),
    };
  }

  return {
    specVersion: HISTORY_SPEC_VERSION,
    id: entryId,
    timestamp: metaFile.timestamp,
    signature: metaFile.signature,
    environmentId: metaFile.environmentId,
    source: metaFile.source,
    request,
    resolvedUrl: requestFile.resolvedUrl,
    captureResponse: metaFile.captureResponse,
    durationMs: metaFile.durationMs,
    ...(response ? { response } : {}),
    ...(metaFile.error ? { error: metaFile.error } : {}),
  };
}

function loadEntryFromDisk(
  workspaceRoot: string,
  dayPath: string,
  entryId: string
): HistoryEntry | undefined {
  const dir = entryDir(workspaceRoot, dayPath, entryId);
  const requestFile = readJson<HistoryRequestFile | undefined>(
    path.join(dir, REQUEST_FILE),
    undefined
  );
  const metaFile = readJson<HistoryMetaFile | undefined>(path.join(dir, META_FILE), undefined);
  if (!requestFile || !metaFile) {
    return undefined;
  }
  const responseFile = readJson<HistoryResponseFile | undefined>(
    path.join(dir, RESPONSE_FILE),
    undefined
  );
  return assembleHistoryEntry(entryId, requestFile, metaFile, responseFile);
}

function migrateLegacyEntry(
  legacy: HistoryEntry,
  dailyByDay: Map<string, HistoryDailySummary[]>
): { dayPath: string; summary: HistoryDailySummary } {
  const dayPath = dayPathFromTimestamp(legacy.timestamp);
  const resolvedPath = pathFromUrl(legacy.resolvedUrl);
  const summary = indexEntryToDailySummary(
    {
      id: legacy.id,
      timestamp: legacy.timestamp,
      signature: legacy.signature,
      method: legacy.request.method,
      path: resolvedPath,
      statusCode: legacy.response?.statusCode,
      durationMs: legacy.durationMs,
      environmentId: legacy.environmentId,
      captureResponse: legacy.captureResponse,
    },
    resolvedPath
  );

  const list = dailyByDay.get(dayPath) ?? [];
  list.push(summary);
  dailyByDay.set(dayPath, list);
  return { dayPath, summary };
}

function removeLegacyStorage(workspaceRoot: string): void {
  const legacyDir = legacyEntriesDir(workspaceRoot);
  if (fs.existsSync(legacyDir)) {
    fs.rmSync(legacyDir, { recursive: true, force: true });
  }
}

function migrateLegacyHistory(workspaceRoot: string): boolean {
  ensureHistoryRoot(workspaceRoot);
  const indexFile = globalIndexPath(workspaceRoot);
  const legacyDir = legacyEntriesDir(workspaceRoot);
  const raw = fs.existsSync(indexFile)
    ? readJson<unknown>(indexFile, null)
    : null;

  const hasLegacyEntriesDir = fs.existsSync(legacyDir);
  const hasLegacyIndex = isLegacyGlobalIndex(raw);
  if (!hasLegacyEntriesDir && !hasLegacyIndex) {
    return false;
  }

  const legacySummaries: HistoryIndexEntry[] = hasLegacyIndex ? raw.entries : [];
  const legacyIds = new Set(legacySummaries.map((entry) => entry.id));

  if (hasLegacyEntriesDir) {
    for (const file of fs.readdirSync(legacyDir).filter((name) => name.endsWith('.json'))) {
      legacyIds.add(file.replace(/\.json$/, ''));
    }
  }

  const dailyByDay = new Map<string, HistoryDailySummary[]>();
  let lastEntryId: string | undefined;

  for (const entryId of legacyIds) {
    const legacyFile = path.join(legacyDir, `${entryId}.json`);
    const legacy = readJson<HistoryEntry | undefined>(legacyFile, undefined);
    if (!legacy) {
      continue;
    }

    const normalized: HistoryEntry = {
      ...legacy,
      specVersion: HISTORY_SPEC_VERSION,
    };
    const { dayPath } = migrateLegacyEntry(normalized, dailyByDay);
    writeEntryFiles(workspaceRoot, dayPath, normalized);

    if (!lastEntryId || parseHistoryIdNumber(entryId) > parseHistoryIdNumber(lastEntryId)) {
      lastEntryId = entryId;
    }
  }

  const days = [...dailyByDay.keys()].sort((a, b) => b.localeCompare(a));
  for (const dayPath of days) {
    const entries = (dailyByDay.get(dayPath) ?? []).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    );
    writeDailyIndex(workspaceRoot, dayPath, {
      date: isoDateFromDayPath(dayPath),
      entries,
    });
  }

  writeGlobalIndex(workspaceRoot, {
    specVersion: HISTORY_SPEC_VERSION,
    days,
    lastEntryId,
  });

  removeLegacyStorage(workspaceRoot);
  return true;
}

export interface RecordHistoryInput {
  environmentId: string;
  source: HistorySourceContext;
  request: ApiRequest;
  resolvedUrl: string;
  response?: ApiResponse;
  captureResponse: boolean;
  durationMs: number;
  error?: string;
  path?: string;
}

export class HistoryService {
  private globalIndex: HistoryGlobalIndex = emptyGlobalIndex();
  private loadedDailyIndexes = new Map<string, HistoryDailyIndex>();
  private loadedDayCount = 0;
  private initialized = false;

  constructor(private readonly workspaceRoot: string) {}

  initialize(): void {
    if (this.initialized) {
      return;
    }
    ensureHistoryRoot(this.workspaceRoot);
    migrateLegacyHistory(this.workspaceRoot);
    this.globalIndex = readGlobalIndexFromDisk(this.workspaceRoot);
    if (!fs.existsSync(globalIndexPath(this.workspaceRoot))) {
      writeGlobalIndex(this.workspaceRoot, this.globalIndex);
    }
    this.loadRecentDays(DEFAULT_RECENT_HISTORY_DAYS);
    this.initialized = true;
  }

  getRecentDays(limit = DEFAULT_RECENT_HISTORY_DAYS): string[] {
    return this.globalIndex.days.slice(0, limit);
  }

  getAvailableDays(): string[] {
    return [...this.globalIndex.days];
  }

  getArchiveYears(): string[] {
    const years = new Set<string>();
    for (const day of this.globalIndex.days) {
      years.add(day.split('/')[0] ?? '');
    }
    return [...years].filter(Boolean).sort((a, b) => b.localeCompare(a));
  }

  getArchiveMonths(year: string): string[] {
    const months = new Set<string>();
    const prefix = `${year}/`;
    for (const day of this.globalIndex.days) {
      if (day.startsWith(prefix)) {
        months.add(day.slice(prefix.length, prefix.length + 2));
      }
    }
    return [...months].sort((a, b) => b.localeCompare(a));
  }

  getDayEntries(dayPath: string): HistoryIndexEntry[] {
    const daily = this.ensureDayLoaded(dayPath);
    if (!daily) {
      return [];
    }
    return daily.entries.map(dailySummaryToIndexEntry);
  }

  listLoadedSummaries(): HistoryIndexEntry[] {
    const entries: HistoryIndexEntry[] = [];
    const loadedDays = this.globalIndex.days.slice(0, this.loadedDayCount);
    for (const dayPath of loadedDays) {
      const daily = this.loadedDailyIndexes.get(dayPath);
      if (daily) {
        entries.push(...daily.entries.map(dailySummaryToIndexEntry));
      }
    }
    return entries;
  }

  loadRecentDays(count: number): HistoryIndexEntry[] {
    const start = 0;
    const end = Math.min(count, this.globalIndex.days.length);
    for (let i = this.loadedDayCount; i < end; i++) {
      const dayPath = this.globalIndex.days[i];
      if (dayPath) {
        this.loadDayIndex(dayPath);
      }
    }
    this.loadedDayCount = Math.max(this.loadedDayCount, end);
    return this.listLoadedSummaries();
  }

  loadNextDays(count: number): HistoryIndexEntry[] {
    const start = this.loadedDayCount;
    const end = Math.min(start + count, this.globalIndex.days.length);
    for (let i = start; i < end; i++) {
      const dayPath = this.globalIndex.days[i];
      if (dayPath) {
        this.loadDayIndex(dayPath);
      }
    }
    this.loadedDayCount = end;
    return this.listLoadedSummaries();
  }

  hasMoreDays(): boolean {
    return this.loadedDayCount < this.globalIndex.days.length;
  }

  getHistoryEntry(historyId: string): HistoryEntry | undefined {
    for (const dayPath of this.globalIndex.days) {
      const daily = this.ensureDayLoaded(dayPath);
      if (!daily) {
        continue;
      }
      if (daily.entries.some((entry) => entry.id === historyId)) {
        return loadEntryFromDisk(this.workspaceRoot, dayPath, historyId);
      }
    }
    return undefined;
  }

  recordHistoryEntry(input: RecordHistoryInput): HistoryEntry {
    const id = nextHistoryId(this.globalIndex.lastEntryId);
    const timestamp = new Date().toISOString();
    const resolvedPath = input.path ?? pathFromUrl(input.resolvedUrl);
    const signature = requestSignature(input.request.method, resolvedPath);
    const dayPath = dayPathFromTimestamp(timestamp);

    const entry: HistoryEntry = {
      specVersion: HISTORY_SPEC_VERSION,
      id,
      timestamp,
      signature,
      environmentId: input.environmentId,
      source: input.source,
      request: input.request,
      resolvedUrl: input.resolvedUrl,
      captureResponse: input.captureResponse,
      durationMs: input.durationMs,
      ...(input.response ? { response: historyResponseSnapshot(input.response, input.captureResponse) } : {}),
      ...(input.error ? { error: input.error } : {}),
    };

    writeEntryFiles(this.workspaceRoot, dayPath, entry);

    const summary = indexEntryToDailySummary(
      {
        id,
        timestamp,
        signature,
        method: input.request.method,
        path: resolvedPath,
        statusCode: input.response?.statusCode,
        durationMs: input.durationMs,
        environmentId: input.environmentId,
        captureResponse: input.captureResponse,
      },
      resolvedPath
    );

    const existingDaily = this.loadedDailyIndexes.get(dayPath) ?? readDailyIndexFromDisk(this.workspaceRoot, dayPath);
    const daily: HistoryDailyIndex = existingDaily ?? {
      date: isoDateFromDayPath(dayPath),
      entries: [],
    };
    daily.entries.unshift(summary);
    writeDailyIndex(this.workspaceRoot, dayPath, daily);
    this.loadedDailyIndexes.set(dayPath, daily);

    upsertDayInGlobalIndex(this.globalIndex, dayPath);
    this.globalIndex.lastEntryId = id;
    writeGlobalIndex(this.workspaceRoot, this.globalIndex);

    const dayIndex = this.globalIndex.days.indexOf(dayPath);
    if (dayIndex >= 0) {
      this.loadedDayCount = Math.max(this.loadedDayCount, dayIndex + 1);
    }

    return entry;
  }

  private loadDayIndex(dayPath: string): void {
    if (this.loadedDailyIndexes.has(dayPath)) {
      return;
    }
    const daily = readDailyIndexFromDisk(this.workspaceRoot, dayPath);
    if (daily) {
      this.loadedDailyIndexes.set(dayPath, daily);
    }
  }

  private ensureDayLoaded(dayPath: string): HistoryDailyIndex | undefined {
    if (!this.loadedDailyIndexes.has(dayPath)) {
      this.loadDayIndex(dayPath);
    }
    return this.loadedDailyIndexes.get(dayPath);
  }
}

const services = new Map<string, HistoryService>();

export function getHistoryService(workspaceRoot: string): HistoryService {
  let service = services.get(workspaceRoot);
  if (!service) {
    service = new HistoryService(workspaceRoot);
    service.initialize();
    services.set(workspaceRoot, service);
  }
  return service;
}

export function resetHistoryServiceForTests(workspaceRoot?: string): void {
  if (workspaceRoot) {
    services.delete(workspaceRoot);
    return;
  }
  services.clear();
}

/** @deprecated Use getHistoryService().listLoadedSummaries() */
export function listHistorySummaries(workspaceRoot: string): HistoryIndexEntry[] {
  return getHistoryService(workspaceRoot).listLoadedSummaries();
}

/** @deprecated Use getHistoryService().getHistoryEntry() */
export function loadHistoryEntry(workspaceRoot: string, id: string): HistoryEntry | undefined {
  return getHistoryService(workspaceRoot).getHistoryEntry(id);
}

/** @deprecated Use getHistoryService().recordHistoryEntry() */
export function recordHistoryEntry(workspaceRoot: string, input: RecordHistoryInput): HistoryEntry {
  return getHistoryService(workspaceRoot).recordHistoryEntry(input);
}

export { HISTORY_LEGACY_SPEC_VERSION };

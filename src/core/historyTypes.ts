import type {
  ApiRequest,
  ApiResponse,
  HttpMethod,
  KeyValuePair,
  RequestAutomation,
  RequestAuthorization,
  RequestUi,
} from './types';

/** Legacy flat index format (history/v1). */
export const HISTORY_LEGACY_SPEC_VERSION = 'history/v1';

/** Current on-disk history layout version. */
export const HISTORY_SPEC_VERSION = 'history/v2';

export const DRAFT_SPEC_VERSION = 'draft/v1';

export const DEFAULT_RECENT_HISTORY_DAYS = 5;

export interface HistorySourceContext {
  kind: 'collection' | 'draft' | 'adhoc';
  collectionId?: string;
  requestId?: string;
  draftId?: string;
}

/** Summary row stored in a daily index and sent to the History sidebar. */
export interface HistoryIndexEntry {
  id: string;
  timestamp: string;
  signature: string;
  method: HttpMethod;
  path: string;
  statusCode?: number;
  durationMs: number;
  environmentId: string;
  captureResponse: boolean;
}

/** Legacy flat global index (pre-v2). */
export interface HistoryLegacyIndex {
  specVersion: typeof HISTORY_LEGACY_SPEC_VERSION;
  entries: HistoryIndexEntry[];
}

/** Global history index — available days only, newest first. */
export interface HistoryGlobalIndex {
  specVersion: typeof HISTORY_SPEC_VERSION;
  days: string[];
  lastEntryId?: string;
}

/** Per-day index at `.apiscope/history/YYYY/MM/DD/index.json`. */
export interface HistoryDailyIndex {
  date: string;
  entries: HistoryDailySummary[];
}

/** Summary fields for a single execution within a daily index. */
export interface HistoryDailySummary {
  id: string;
  timestamp: string;
  method: HttpMethod;
  url: string;
  status?: number;
  signature: string;
  path: string;
  statusCode?: number;
  durationMs: number;
  environmentId: string;
  captureResponse: boolean;
}

export interface HistoryEntry {
  specVersion: typeof HISTORY_SPEC_VERSION;
  id: string;
  timestamp: string;
  signature: string;
  environmentId: string;
  source: HistorySourceContext;
  request: ApiRequest;
  resolvedUrl: string;
  response?: ApiResponse;
  captureResponse: boolean;
  durationMs: number;
  error?: string;
}

/** Stored at `{entryId}/request.json`. */
export interface HistoryRequestFile {
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  body?: string;
  requestBody?: import('./requestBody').RequestBody;
  resolvedUrl: string;
}

/** Stored at `{entryId}/response.json` when a response was captured. */
export interface HistoryResponseFile {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body?: string;
  durationMs: number;
  fileResponse?: import('./fileResponse').FileResponseMetadata;
}

/** Stored at `{entryId}/meta.json` — metadata not shown in daily indexes. */
export interface HistoryMetaFile {
  timestamp: string;
  signature: string;
  environmentId: string;
  source: HistorySourceContext;
  captureResponse: boolean;
  durationMs: number;
  error?: string;
}

export interface DraftDocument {
  specVersion: typeof DRAFT_SPEC_VERSION;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceHistoryId?: string;
  method: HttpMethod;
  url: string;
  path: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  body?: string;
  requestBody?: import('./requestBody').RequestBody;
  authorization?: RequestAuthorization;
  automation?: RequestAutomation;
  ui?: RequestUi;
}

export interface DraftSummary {
  id: string;
  name: string;
  method: HttpMethod;
  path: string;
  updatedAt: string;
}

export function requestSignature(method: HttpMethod, path: string): string {
  return `${method} ${path}`;
}

export function pathFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || '/';
  } catch {
    const withoutQuery = url.split('?')[0] ?? url;
    const match = withoutQuery.match(/^https?:\/\/[^/]+(\/.*)?$/i);
    if (match) {
      return match[1] || '/';
    }
    if (withoutQuery.startsWith('/')) {
      return withoutQuery;
    }
    return '/';
  }
}

/** Folder path segment `YYYY/MM/DD` from an ISO timestamp. */
export function dayPathFromTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

/** ISO date `YYYY-MM-DD` from a day folder path `YYYY/MM/DD`. */
export function isoDateFromDayPath(dayPath: string): string {
  return dayPath.replace(/\//g, '-');
}

export function dailySummaryToIndexEntry(summary: HistoryDailySummary): HistoryIndexEntry {
  return {
    id: summary.id,
    timestamp: summary.timestamp,
    signature: summary.signature,
    method: summary.method,
    path: summary.path,
    statusCode: summary.statusCode ?? summary.status,
    durationMs: summary.durationMs,
    environmentId: summary.environmentId,
    captureResponse: summary.captureResponse,
  };
}

export function indexEntryToDailySummary(entry: HistoryIndexEntry, url?: string): HistoryDailySummary {
  return {
    id: entry.id,
    timestamp: entry.timestamp,
    method: entry.method,
    url: url ?? entry.path,
    status: entry.statusCode,
    signature: entry.signature,
    path: entry.path,
    statusCode: entry.statusCode,
    durationMs: entry.durationMs,
    environmentId: entry.environmentId,
    captureResponse: entry.captureResponse,
  };
}

import * as fs from 'fs';
import * as path from 'path';
import { buildDefaultHeaders } from '../request-executor/RequestExecutor';
import {
  DRAFT_SPEC_VERSION,
  DraftDocument,
  DraftSummary,
  HistoryEntry,
  pathFromUrl,
} from '../core/historyTypes';
import type { ApiRequest, HttpMethod, KeyValuePair } from '../core/types';
import { ensureApiscopeRoot, getApiscopeDir, apiscopeExists } from './ApiScopeStorage';

const DRAFTS_DIR = 'drafts';

function draftsDir(workspaceRoot: string): string {
  return path.join(getApiscopeDir(workspaceRoot), DRAFTS_DIR);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensureDraftsLayout(workspaceRoot: string): void {
  ensureApiscopeRoot(workspaceRoot);
  ensureDir(draftsDir(workspaceRoot));
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

function draftPath(workspaceRoot: string, id: string): string {
  return path.join(draftsDir(workspaceRoot), `${id}.json`);
}

function nextDraftId(workspaceRoot: string): string {
  ensureDraftsLayout(workspaceRoot);
  const files = fs.existsSync(draftsDir(workspaceRoot))
    ? fs.readdirSync(draftsDir(workspaceRoot)).filter((f) => f.endsWith('.json'))
    : [];
  const existing = files
    .map((f) => {
      const m = f.replace(/\.json$/, '').match(/^draft-(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => !Number.isNaN(n) && n > 0);
  const next = existing.length ? Math.max(...existing) + 1 : 1;
  return `draft-${String(next).padStart(3, '0')}`;
}

function draftDisplayName(index: number, method: HttpMethod, pathValue: string): string {
  return `${method} ${pathValue}`;
}

function toSummary(doc: DraftDocument): DraftSummary {
  return {
    id: doc.id,
    name: doc.name,
    method: doc.method,
    path: doc.path,
    updatedAt: doc.updatedAt,
  };
}

export function listDrafts(workspaceRoot: string): DraftSummary[] {
  if (!apiscopeExists(workspaceRoot)) {
    return [];
  }
  const dir = draftsDir(workspaceRoot);
  if (!fs.existsSync(dir)) {
    return [];
  }
  const drafts: DraftDocument[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const doc = readJson<DraftDocument | undefined>(path.join(dir, file), undefined);
    if (doc) {
      drafts.push(doc);
    }
  }
  return drafts
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(toSummary);
}

export function loadDraft(workspaceRoot: string, id: string): DraftDocument | undefined {
  ensureDraftsLayout(workspaceRoot);
  return readJson<DraftDocument | undefined>(draftPath(workspaceRoot, id), undefined);
}

export function createDraftFromHistory(
  workspaceRoot: string,
  history: HistoryEntry
): DraftDocument {
  ensureDraftsLayout(workspaceRoot);
  const id = nextDraftId(workspaceRoot);
  const now = new Date().toISOString();
  const resolvedPath = pathFromUrl(history.resolvedUrl);
  const existingCount = listDrafts(workspaceRoot).length;
  const name = draftDisplayName(existingCount + 1, history.request.method, resolvedPath);

  const doc: DraftDocument = {
    specVersion: DRAFT_SPEC_VERSION,
    id,
    name,
    createdAt: now,
    updatedAt: now,
    sourceHistoryId: history.id,
    method: history.request.method,
    url: history.request.url,
    path: resolvedPath,
    headers: history.request.headers,
    queryParams: history.request.queryParams,
    body: history.request.body,
    requestBody: history.request.requestBody,
  };

  writeJson(draftPath(workspaceRoot, id), doc);
  return doc;
}

export function createEmptyDraft(workspaceRoot: string): DraftDocument {
  ensureDraftsLayout(workspaceRoot);
  const id = nextDraftId(workspaceRoot);
  const now = new Date().toISOString();
  const existingCount = listDrafts(workspaceRoot).length;
  const doc: DraftDocument = {
    specVersion: DRAFT_SPEC_VERSION,
    id,
    name: `Draft ${existingCount + 1}`,
    createdAt: now,
    updatedAt: now,
    method: 'GET',
    url: '{{baseUrl}}/',
    path: '/',
    headers: buildDefaultHeaders(),
    queryParams: [],
  };
  writeJson(draftPath(workspaceRoot, id), doc);
  return doc;
}

export function updateDraft(
  workspaceRoot: string,
  id: string,
  patch: Partial<
    Pick<
      DraftDocument,
      | 'name'
      | 'method'
      | 'url'
      | 'path'
      | 'headers'
      | 'queryParams'
      | 'body'
      | 'requestBody'
      | 'authorization'
      | 'automation'
      | 'ui'
    >
  >
): DraftDocument | undefined {
  const existing = loadDraft(workspaceRoot, id);
  if (!existing) {
    return undefined;
  }
  const updated: DraftDocument = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (patch.url !== undefined && patch.path === undefined) {
    updated.path = pathFromUrl(patch.url);
  }
  writeJson(draftPath(workspaceRoot, id), updated);
  return updated;
}

export function deleteDraft(workspaceRoot: string, id: string): boolean {
  const file = draftPath(workspaceRoot, id);
  if (!fs.existsSync(file)) {
    return false;
  }
  fs.unlinkSync(file);
  return true;
}

export function draftToApiRequest(doc: DraftDocument): ApiRequest {
  return {
    method: doc.method,
    url: doc.url,
    headers: doc.headers,
    queryParams: doc.queryParams,
    body: doc.body,
    authorization: doc.authorization,
    automation: doc.automation,
    ui: doc.ui,
  };
}

export function apiRequestToDraftPatch(
  request: ApiRequest,
  name?: string
): Partial<
  Pick<
    DraftDocument,
    | 'name'
    | 'method'
    | 'url'
    | 'path'
    | 'headers'
    | 'queryParams'
    | 'body'
    | 'requestBody'
    | 'authorization'
    | 'automation'
    | 'ui'
  >
> {
  return {
    ...(name !== undefined ? { name } : {}),
    method: request.method,
    url: request.url,
    path: pathFromUrl(request.url),
    headers: request.headers,
    queryParams: request.queryParams,
    body: request.body,
    requestBody: request.requestBody,
    authorization: request.authorization,
    automation: request.automation,
    ui: request.ui,
  };
}

export function draftToCollectionRequestFields(
  doc: DraftDocument
): {
  method: HttpMethod;
  url: string;
  path: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  body?: string;
  name: string;
} {
  return {
    name: doc.name,
    method: doc.method,
    url: doc.url,
    path: doc.path,
    headers: doc.headers,
    queryParams: doc.queryParams,
    body: doc.body,
  };
}

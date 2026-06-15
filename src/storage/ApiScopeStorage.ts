import * as fs from 'fs';
import * as path from 'path';
import { normalizeSourceFile, toRelativePath } from '../core/pathUtils';
import { resolveCollectionRequestDisplayName } from '../core/requestDisplayName';
import { buildDefaultHeaders } from '../request-executor/RequestExecutor';
import {
  ApiScopeConfig,
  AUTO_GENERATED_COLLECTION_ID,
  AUTO_GENERATED_COLLECTION_NAME,
  Collection,
  CollectionMetadata,
  CollectionRequest,
  CollectionsIndex,
  CONFIG_VERSION,
  ControllerGroup,
  GENERATED_ENVIRONMENT_ID,
  GENERATED_ENVIRONMENT_NAME,
  Environment,
  EnvironmentIndexEntry,
  EnvironmentsIndex,
  EnvironmentSource,
  EnvironmentTier,
  EnvironmentVariable,
  LastScanRecord,
  StoredRequest,
  TreeDocument,
} from '../core/types';
import {
  collectRequestIdsFromTree,
  controllersToTree,
  insertRequestInTree,
  remapTreeRequestIds,
  removeRequestFromTree,
  treeToControllers,
} from './treeAdapter';
import {
  collectFolderDeleteStats,
  createFolder,
  deleteFolder,
  insertRequestAt,
  moveFolder,
  moveRequest,
  renameFolder,
  reorderInFolder,
  reorderRoot,
} from './treeOperations';

export const APISCOPE_DIR = '.apiscope';

const CONFIG_FILE = 'config.json';
const GITIGNORE_FILE = '.gitignore';
const COLLECTIONS_DIR = 'collections';
const INDEX_FILE = 'index.json';
const COLLECTION_META_FILE = 'collection.json';
const TREE_FILE = 'tree.json';
const REQUESTS_DIR = 'requests';
const ENVIRONMENTS_DIR = 'environments';
const SCANS_DIR = 'scans';
const HISTORY_DIR = 'history';
const DRAFTS_DIR = 'drafts';
const DOWNLOADS_DIR = 'downloads';
const LAST_SCAN_FILE = 'last-scan.json';

const LEGACY_COLLECTIONS = 'collections.json';
const LEGACY_ENVIRONMENTS = 'environments.json';
const LEGACY_SETTINGS = 'settings.json';

const GITIGNORE_CONTENT = `collections/auto-generated/
environments/
scans/
history/
drafts/
downloads/
`;

export function getApiscopeDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, APISCOPE_DIR);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
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
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function collectionsDir(workspaceRoot: string): string {
  return path.join(getApiscopeDir(workspaceRoot), COLLECTIONS_DIR);
}

function collectionDir(workspaceRoot: string, id: string): string {
  return path.join(collectionsDir(workspaceRoot), id);
}

function environmentsDir(workspaceRoot: string): string {
  return path.join(getApiscopeDir(workspaceRoot), ENVIRONMENTS_DIR);
}

function scansDir(workspaceRoot: string): string {
  return path.join(getApiscopeDir(workspaceRoot), SCANS_DIR);
}

function indexPath(workspaceRoot: string): string {
  return path.join(collectionsDir(workspaceRoot), INDEX_FILE);
}

function ensureGitignore(workspaceRoot: string): void {
  const file = path.join(getApiscopeDir(workspaceRoot), GITIGNORE_FILE);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, GITIGNORE_CONTENT, 'utf-8');
    return;
  }
  let content = fs.readFileSync(file, 'utf-8');
  let changed = false;
  for (const line of ['environments/', 'history/', 'drafts/', 'downloads/']) {
    if (!content.includes(line)) {
      if (content.length > 0 && !content.endsWith('\n')) {
        content += '\n';
      }
      content += `${line}\n`;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(file, content, 'utf-8');
  }
}

export function ensureApiscopeLayout(workspaceRoot: string): void {
  const root = getApiscopeDir(workspaceRoot);
  ensureDir(root);
  ensureDir(collectionsDir(workspaceRoot));
  ensureDir(environmentsDir(workspaceRoot));
  ensureDir(scansDir(workspaceRoot));
  ensureDir(path.join(root, HISTORY_DIR));
  ensureDir(path.join(root, DRAFTS_DIR));
  ensureDir(path.join(root, DOWNLOADS_DIR));
  ensureGitignore(workspaceRoot);
  migrateLegacyStorage(workspaceRoot);
  migrateMonolithicCollections(workspaceRoot);
  migrateFlatEnvironments(workspaceRoot);
}

// ── Legacy migration (collections.json → folder structure) ──────────────────

interface LegacyCollection {
  id: string;
  name: string;
  type: 'generated' | 'user';
  createdAt: string;
  updatedAt: string;
  isDirty?: boolean;
  requests?: LegacyRequest[];
}

interface LegacyRequest {
  id: string;
  name?: string;
  method: string;
  url: string;
  headers: unknown[];
  queryParams: unknown[];
  body?: string;
  sourceKey?: string;
  controllerName?: string;
  path: string;
  filePath?: string;
  line?: number;
  sourceFile?: string;
  sourceLine?: number;
}

function migrateLegacyStorage(workspaceRoot: string): void {
  const root = getApiscopeDir(workspaceRoot);
  const legacyCollections = path.join(root, LEGACY_COLLECTIONS);
  if (!fs.existsSync(legacyCollections)) {
    return;
  }

  const data = readJson<{ collections?: LegacyCollection[] }>(legacyCollections, {});
  const index: CollectionsIndex = { collections: [] };

  for (const col of data.collections ?? []) {
    const controllers = migrateRequestsToControllers(col.requests ?? []);
    const collection = assembleCollectionFromParts(
      {
        id: col.id,
        name: col.name,
        type: col.type,
        createdAt: col.createdAt,
        updatedAt: col.updatedAt,
        isDirty: col.isDirty,
      },
      controllersToTree(controllers),
      controllersToStoredRequests(controllers, workspaceRoot)
    );
    persistCollection(workspaceRoot, collection, index);
  }

  const legacyEnvs = path.join(root, LEGACY_ENVIRONMENTS);
  if (fs.existsSync(legacyEnvs)) {
    const envData = readJson<{ environments?: LegacyEnvironment[] }>(legacyEnvs, {});
    const envIndex: EnvironmentsIndex = { environments: [] };
    for (const env of envData.environments ?? []) {
      persistEnvironment(workspaceRoot, migrateLegacyEnvironment(env), envIndex);
    }
    saveEnvironmentsIndex(workspaceRoot, sortEnvironmentIndex(envIndex));
  }

  const legacySettings = path.join(root, LEGACY_SETTINGS);
  const settings = readJson<{ activeEnvironmentId?: string }>(legacySettings, {});
  const configPath = path.join(root, CONFIG_FILE);
  const config = readJson<ApiScopeConfig>(configPath, defaultConfig());
  writeJson(configPath, {
    ...config,
    version: CONFIG_VERSION,
    activeEnvironmentId: settings.activeEnvironmentId ?? config.activeEnvironmentId,
  });

  try {
    fs.unlinkSync(legacyCollections);
    if (fs.existsSync(legacyEnvs)) {
      fs.unlinkSync(legacyEnvs);
    }
    if (fs.existsSync(legacySettings)) {
      fs.unlinkSync(legacySettings);
    }
  } catch {
    // non-fatal
  }

  saveCollectionsIndex(workspaceRoot, index);
}

function migrateRequestsToControllers(requests: LegacyRequest[]): ControllerGroup[] {
  const map = new Map<string, LegacyRequest[]>();
  for (const req of requests) {
    const key = req.controllerName ?? 'Other';
    const list = map.get(key) ?? [];
    list.push(req);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, reqs]) => ({
      name,
      requests: reqs.map((r) => legacyRequestToCollectionRequest(r)),
    }));
}

function legacyRequestToCollectionRequest(r: LegacyRequest): CollectionRequest {
  return {
    id: r.id,
    name: r.name,
    method: r.method as CollectionRequest['method'],
    url: r.url,
    headers: r.headers as CollectionRequest['headers'],
    queryParams: r.queryParams as CollectionRequest['queryParams'],
    body: r.body,
    sourceKey: r.sourceKey,
    path: r.path,
    sourceFile: r.sourceFile,
    sourceLine: r.sourceLine ?? r.line,
    filePath: r.filePath,
    line: r.line,
  };
}

// ── Monolithic migration ({id}.json → folder structure) ─────────────────────

function migrateMonolithicCollections(workspaceRoot: string): void {
  const dir = collectionsDir(workspaceRoot);
  if (fs.existsSync(indexPath(workspaceRoot))) {
    return;
  }

  const monolithic = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== INDEX_FILE);
  if (monolithic.length === 0) {
    writeJson(indexPath(workspaceRoot), { collections: [] });
    return;
  }

  // Mark migration in progress so persistCollection does not re-enter.
  writeJson(indexPath(workspaceRoot), { collections: [] });

  const index: CollectionsIndex = { collections: [] };

  for (const file of monolithic) {
    const col = readJson<Collection | undefined>(path.join(dir, file), undefined);
    if (!col) {
      continue;
    }
    persistCollection(workspaceRoot, col, index);
    try {
      fs.unlinkSync(path.join(dir, file));
    } catch {
      // non-fatal
    }
  }

  saveCollectionsIndex(workspaceRoot, sortIndex(index));

  const config = loadConfigRaw(workspaceRoot);
  if (config.version < CONFIG_VERSION) {
    saveConfigRaw(workspaceRoot, { ...config, version: CONFIG_VERSION });
  }
}

// ── Index ───────────────────────────────────────────────────────────────────

export function loadCollectionsIndex(workspaceRoot: string): CollectionsIndex {
  ensureApiscopeLayout(workspaceRoot);
  return readJson<CollectionsIndex>(indexPath(workspaceRoot), { collections: [] });
}

export function saveCollectionsIndex(workspaceRoot: string, index: CollectionsIndex): void {
  ensureDir(collectionsDir(workspaceRoot));
  writeJson(indexPath(workspaceRoot), index);
}

function upsertIndexEntry(index: CollectionsIndex, entry: CollectionsIndex['collections'][0]): void {
  const idx = index.collections.findIndex((c) => c.id === entry.id);
  if (idx >= 0) {
    index.collections[idx] = entry;
  } else {
    index.collections.push(entry);
  }
}

function removeIndexEntry(index: CollectionsIndex, id: string): void {
  index.collections = index.collections.filter((c) => c.id !== id);
}

function sortIndex(index: CollectionsIndex): CollectionsIndex {
  index.collections.sort((a, b) => {
    if (a.type === 'generated') {
      return -1;
    }
    if (b.type === 'generated') {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
  return index;
}

// ── Request serialization ─────────────────────────────────────────────────────

function requestDisplayName(req: CollectionRequest): string {
  return resolveCollectionRequestDisplayName(req);
}

function toStoredRequest(req: CollectionRequest, workspaceRoot: string): StoredRequest {
  const stored: StoredRequest = {
    id: req.id,
    displayName: req.displayName ?? requestDisplayName(req),
    method: req.method,
    url: req.url,
    headers: req.headers,
    queryParams: req.queryParams,
    path: req.path,
  };
  if (req.displayNameOverride) {
    stored.displayNameOverride = true;
  }
  if (req.name?.trim()) {
    stored.name = req.name.trim();
  }
  if (req.body !== undefined) {
    stored.body = req.body;
  }
  if (req.requestBody !== undefined) {
    stored.requestBody = req.requestBody;
  }
  if (req.sourceKey) {
    stored.sourceKey = req.sourceKey;
  }
  const sourceFile = normalizeSourceFile(workspaceRoot, req.sourceFile, req.filePath);
  if (sourceFile) {
    stored.sourceFile = sourceFile;
  }
  const sourceLine = req.sourceLine ?? req.line;
  if (stored.sourceLine !== undefined) {
    stored.sourceLine = sourceLine;
  }
  if (req.captureResponse !== undefined) {
    stored.captureResponse = req.captureResponse;
  }
  if (req.authorization !== undefined) {
    stored.authorization = req.authorization;
  }
  if (req.automation !== undefined) {
    stored.automation = req.automation;
  }
  if (req.ui !== undefined) {
    stored.ui = req.ui;
  }
  return stored;
}

export function serializeCollectionRequest(
  req: CollectionRequest,
  workspaceRoot: string
): StoredRequest {
  return toStoredRequest(req, workspaceRoot);
}

function fromStoredRequest(stored: StoredRequest, workspaceRoot: string): CollectionRequest {
  const req: CollectionRequest = {
    id: stored.id,
    displayName: stored.displayName,
    displayNameOverride: stored.displayNameOverride,
    name: stored.name,
    method: stored.method,
    url: stored.url,
    headers: stored.headers,
    queryParams: stored.queryParams,
    path: stored.path,
  };
  if (stored.body !== undefined) {
    req.body = stored.body;
  }
  if (stored.requestBody !== undefined) {
    req.requestBody = stored.requestBody;
  }
  if (stored.sourceKey) {
    req.sourceKey = stored.sourceKey;
  }
  if (stored.sourceFile) {
    req.sourceFile = stored.sourceFile;
    req.filePath = path.join(workspaceRoot, stored.sourceFile);
  }
  if (stored.sourceLine !== undefined) {
    req.sourceLine = stored.sourceLine;
    req.line = stored.sourceLine;
  }
  if (stored.captureResponse !== undefined) {
    req.captureResponse = stored.captureResponse;
  }
  if (stored.authorization !== undefined) {
    req.authorization = stored.authorization;
  }
  if (stored.automation !== undefined) {
    req.automation = stored.automation;
  }
  if (stored.ui !== undefined) {
    req.ui = stored.ui;
  }
  return req;
}

function controllersToStoredRequests(
  controllers: ControllerGroup[],
  workspaceRoot: string
): Map<string, StoredRequest> {
  const map = new Map<string, StoredRequest>();
  for (const group of controllers) {
    for (const req of group.requests) {
      map.set(req.id, toStoredRequest(req, workspaceRoot));
    }
  }
  return map;
}

function assembleCollectionFromParts(
  metadata: CollectionMetadata,
  tree: TreeDocument,
  requests: Map<string, StoredRequest>,
  workspaceRoot?: string
): Collection {
  const requestMap = new Map<string, CollectionRequest>();
  for (const [id, stored] of requests) {
    requestMap.set(id, workspaceRoot ? fromStoredRequest(stored, workspaceRoot) : {
      ...stored,
      line: stored.sourceLine,
      filePath: stored.sourceFile,
    } as CollectionRequest);
  }
  return {
    ...metadata,
    controllers: treeToControllers(tree, requestMap),
    tree,
  };
}

// ── Config ──────────────────────────────────────────────────────────────────

function defaultConfig(): ApiScopeConfig {
  return {
    version: CONFIG_VERSION,
    activeCollectionId: AUTO_GENERATED_COLLECTION_ID,
    activeEnvironmentId: GENERATED_ENVIRONMENT_ID,
  };
}

function loadConfigRaw(workspaceRoot: string): ApiScopeConfig {
  return readJson<ApiScopeConfig>(path.join(getApiscopeDir(workspaceRoot), CONFIG_FILE), defaultConfig());
}

function saveConfigRaw(workspaceRoot: string, config: ApiScopeConfig): void {
  writeJson(path.join(getApiscopeDir(workspaceRoot), CONFIG_FILE), config);
}

export function loadConfig(workspaceRoot: string): ApiScopeConfig {
  ensureApiscopeLayout(workspaceRoot);
  return loadConfigRaw(workspaceRoot);
}

export function saveConfig(workspaceRoot: string, config: ApiScopeConfig): void {
  ensureApiscopeLayout(workspaceRoot);
  saveConfigRaw(workspaceRoot, config);
}

// ── Collection I/O ──────────────────────────────────────────────────────────

function loadCollectionMetadata(workspaceRoot: string, id: string): CollectionMetadata | undefined {
  const file = path.join(collectionDir(workspaceRoot, id), COLLECTION_META_FILE);
  return readJson<CollectionMetadata | undefined>(file, undefined);
}

function saveCollectionMetadata(workspaceRoot: string, metadata: CollectionMetadata): void {
  ensureDir(collectionDir(workspaceRoot, metadata.id));
  writeJson(path.join(collectionDir(workspaceRoot, metadata.id), COLLECTION_META_FILE), metadata);
}

export function loadTree(workspaceRoot: string, collectionId: string): TreeDocument {
  const file = path.join(collectionDir(workspaceRoot, collectionId), TREE_FILE);
  return readJson<TreeDocument>(file, { root: [], nodes: {} });
}

export function saveTree(workspaceRoot: string, collectionId: string, tree: TreeDocument): void {
  ensureDir(collectionDir(workspaceRoot, collectionId));
  writeJson(path.join(collectionDir(workspaceRoot, collectionId), TREE_FILE), tree);
}

function loadStoredRequest(workspaceRoot: string, collectionId: string, requestId: string): StoredRequest | undefined {
  const file = path.join(collectionDir(workspaceRoot, collectionId), REQUESTS_DIR, `${requestId}.json`);
  return readJson<StoredRequest | undefined>(file, undefined);
}

function saveStoredRequest(workspaceRoot: string, collectionId: string, request: StoredRequest): void {
  ensureDir(path.join(collectionDir(workspaceRoot, collectionId), REQUESTS_DIR));
  writeJson(
    path.join(collectionDir(workspaceRoot, collectionId), REQUESTS_DIR, `${request.id}.json`),
    request
  );
}

function deleteStoredRequest(workspaceRoot: string, collectionId: string, requestId: string): void {
  const file = path.join(collectionDir(workspaceRoot, collectionId), REQUESTS_DIR, `${requestId}.json`);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

function loadAllStoredRequests(
  workspaceRoot: string,
  collectionId: string
): Map<string, StoredRequest> {
  const dir = path.join(collectionDir(workspaceRoot, collectionId), REQUESTS_DIR);
  const map = new Map<string, StoredRequest>();
  if (!fs.existsSync(dir)) {
    return map;
  }
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const stored = readJson<StoredRequest | undefined>(path.join(dir, file), undefined);
    if (stored) {
      map.set(stored.id, stored);
    }
  }
  return map;
}

function pruneOrphanRequests(
  workspaceRoot: string,
  collectionId: string,
  tree: TreeDocument
): void {
  const dir = path.join(collectionDir(workspaceRoot, collectionId), REQUESTS_DIR);
  if (!fs.existsSync(dir)) {
    return;
  }
  const validIds = collectRequestIdsFromTree(tree);
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const id = file.replace(/\.json$/, '');
    if (!validIds.has(id)) {
      fs.unlinkSync(path.join(dir, file));
    }
  }
}

export function loadCollection(workspaceRoot: string, id: string): Collection | undefined {
  let metadata = loadCollectionMetadata(workspaceRoot, id);
  if (!metadata) {
    return undefined;
  }
  if (
    metadata.id === AUTO_GENERATED_COLLECTION_ID &&
    metadata.name !== AUTO_GENERATED_COLLECTION_NAME
  ) {
    metadata = { ...metadata, name: AUTO_GENERATED_COLLECTION_NAME };
    saveCollectionMetadata(workspaceRoot, metadata);
    const index = loadCollectionsIndex(workspaceRoot);
    upsertIndexEntry(index, {
      id: metadata.id,
      name: metadata.name,
      type: metadata.type,
    });
    saveCollectionsIndex(workspaceRoot, index);
  }
  const tree = loadTree(workspaceRoot, id);
  const stored = loadAllStoredRequests(workspaceRoot, id);
  return assembleCollectionFromParts(metadata, tree, stored, workspaceRoot);
}

export function loadAllCollections(workspaceRoot: string): Collection[] {
  ensureApiscopeLayout(workspaceRoot);
  const index = loadCollectionsIndex(workspaceRoot);
  const collections: Collection[] = [];
  for (const entry of index.collections) {
    const col = loadCollection(workspaceRoot, entry.id);
    if (col) {
      collections.push(col);
    }
  }
  return sortIndex({ collections: index.collections }).collections
    .map((entry) => collections.find((c) => c.id === entry.id))
    .filter((c): c is Collection => c !== undefined);
}

export function persistCollection(
  workspaceRoot: string,
  collection: Collection,
  index?: CollectionsIndex
): void {
  ensureDir(collectionsDir(workspaceRoot));
  ensureDir(collectionDir(workspaceRoot, collection.id));

  const metadata: CollectionMetadata = {
    id: collection.id,
    name: collection.name,
    type: collection.type,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
    isDirty: collection.isDirty,
  };

  const tree = collection.tree ?? controllersToTree(collection.controllers);
  const storedRequests = controllersToStoredRequests(collection.controllers, workspaceRoot);

  saveCollectionMetadata(workspaceRoot, metadata);
  saveTree(workspaceRoot, collection.id, tree);

  for (const [, req] of storedRequests) {
    saveStoredRequest(workspaceRoot, collection.id, req);
  }
  pruneOrphanRequests(workspaceRoot, collection.id, tree);

  const collectionsIndex = index ?? loadCollectionsIndex(workspaceRoot);
  upsertIndexEntry(collectionsIndex, {
    id: collection.id,
    name: collection.name,
    type: collection.type,
  });
  saveCollectionsIndex(workspaceRoot, sortIndex(collectionsIndex));
}

/** Full collection save (scan, bulk updates). */
export function saveCollection(workspaceRoot: string, collection: Collection): void {
  persistCollection(workspaceRoot, collection);
}

export function renameCollectionMetadata(
  workspaceRoot: string,
  collectionId: string,
  name: string,
  updatedAt: string
): void {
  const metadata = loadCollectionMetadata(workspaceRoot, collectionId);
  if (!metadata) {
    return;
  }
  saveCollectionMetadata(workspaceRoot, { ...metadata, name, updatedAt });

  const index = loadCollectionsIndex(workspaceRoot);
  upsertIndexEntry(index, { id: collectionId, name, type: metadata.type });
  saveCollectionsIndex(workspaceRoot, index);
}

export function saveRequest(
  workspaceRoot: string,
  collectionId: string,
  request: CollectionRequest
): void {
  saveStoredRequest(workspaceRoot, collectionId, toStoredRequest(request, workspaceRoot));
}

export function updateRequestFile(
  workspaceRoot: string,
  collectionId: string,
  requestId: string,
  patch: Partial<CollectionRequest>
): CollectionRequest | undefined {
  const metadata = loadCollectionMetadata(workspaceRoot, collectionId);
  if (!metadata) {
    return undefined;
  }

  const collection = loadCollection(workspaceRoot, collectionId);
  if (!collection) {
    return undefined;
  }

  let updated: CollectionRequest | undefined;
  for (const group of collection.controllers) {
    const req = group.requests.find((r) => r.id === requestId);
    if (req) {
      updated = { ...req, ...patch };
      break;
    }
  }
  if (!updated) {
    return undefined;
  }

  saveStoredRequest(workspaceRoot, collectionId, toStoredRequest(updated, workspaceRoot));
  saveCollectionMetadata(workspaceRoot, {
    ...metadata,
    updatedAt: new Date().toISOString(),
    isDirty: metadata.type === 'generated' ? true : metadata.isDirty,
  });

  return updated;
}

export function deleteRequestFromStorage(
  workspaceRoot: string,
  collectionId: string,
  requestId: string
): void {
  const metadata = loadCollectionMetadata(workspaceRoot, collectionId);
  if (!metadata) {
    return;
  }

  deleteStoredRequest(workspaceRoot, collectionId, requestId);
  const tree = removeRequestFromTree(loadTree(workspaceRoot, collectionId), requestId);
  saveTree(workspaceRoot, collectionId, tree);
  saveCollectionMetadata(workspaceRoot, {
    ...metadata,
    updatedAt: new Date().toISOString(),
    isDirty: metadata.type === 'generated' ? true : metadata.isDirty,
  });
}

export function duplicateRequestInStorage(
  workspaceRoot: string,
  collectionId: string,
  source: CollectionRequest,
  controllerName: string,
  copyId: string
): CollectionRequest {
  const metadata = loadCollectionMetadata(workspaceRoot, collectionId);
  if (!metadata) {
    throw new Error(`Collection not found: ${collectionId}`);
  }

  const copy: CollectionRequest = {
    ...source,
    id: copyId,
    name: source.name ? `${source.name} Copy` : undefined,
    sourceKey: undefined,
  };

  saveStoredRequest(workspaceRoot, collectionId, toStoredRequest(copy, workspaceRoot));
  const tree = insertRequestInTree(
    loadTree(workspaceRoot, collectionId),
    copyId,
    controllerName,
    source.id
  );
  saveTree(workspaceRoot, collectionId, tree);
  saveCollectionMetadata(workspaceRoot, {
    ...metadata,
    updatedAt: new Date().toISOString(),
    isDirty: metadata.type === 'generated' ? true : metadata.isDirty,
  });

  return copy;
}

export function duplicateCollectionStorage(
  workspaceRoot: string,
  source: Collection,
  newId: string,
  name: string
): Collection {
  const now = new Date().toISOString();
  const idMap = new Map<string, string>();

  const controllers: ControllerGroup[] = source.controllers.map((g) => ({
    name: g.name,
    requests: g.requests.map((r) => {
      const newReqId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      idMap.set(r.id, newReqId);
      return {
        ...r,
        id: newReqId,
        sourceKey: undefined,
      };
    }),
  }));

  const copy: Collection = {
    id: newId,
    name,
    type: 'user',
    controllers,
    tree: remapTreeRequestIds(source.tree ?? controllersToTree(source.controllers), idMap),
    createdAt: now,
    updatedAt: now,
    isDirty: false,
  };

  persistCollection(workspaceRoot, copy);
  return copy;
}

function touchCollectionMetadata(
  workspaceRoot: string,
  collectionId: string,
  isDirty?: boolean
): void {
  const metadata = loadCollectionMetadata(workspaceRoot, collectionId);
  if (!metadata) {
    return;
  }
  saveCollectionMetadata(workspaceRoot, {
    ...metadata,
    updatedAt: new Date().toISOString(),
    isDirty: metadata.type === 'generated' ? true : isDirty ?? metadata.isDirty,
  });
}

function persistTreeMutation(
  workspaceRoot: string,
  collectionId: string,
  tree: TreeDocument
): Collection | undefined {
  saveTree(workspaceRoot, collectionId, tree);
  pruneOrphanRequests(workspaceRoot, collectionId, tree);
  touchCollectionMetadata(workspaceRoot, collectionId);
  return loadCollection(workspaceRoot, collectionId);
}

export function createFolderInStorage(
  workspaceRoot: string,
  collectionId: string,
  parentFolderId: string | null,
  name: string
): { collection?: Collection; error?: string } {
  const tree = loadTree(workspaceRoot, collectionId);
  const result = createFolder(tree, parentFolderId, name);
  if (!result.ok) {
    return { error: result.error };
  }
  const collection = persistTreeMutation(workspaceRoot, collectionId, result.tree);
  return { collection };
}

export function renameFolderInStorage(
  workspaceRoot: string,
  collectionId: string,
  folderId: string,
  name: string
): { collection?: Collection; error?: string } {
  const tree = loadTree(workspaceRoot, collectionId);
  const result = renameFolder(tree, folderId, name);
  if (!result.ok) {
    return { error: result.error };
  }
  const collection = persistTreeMutation(workspaceRoot, collectionId, result.tree);
  return { collection };
}

export function deleteFolderFromStorage(
  workspaceRoot: string,
  collectionId: string,
  folderId: string
): { collection?: Collection; error?: string } {
  const tree = loadTree(workspaceRoot, collectionId);
  const stats = collectFolderDeleteStats(tree, folderId);
  const result = deleteFolder(tree, folderId);
  if (!result.ok) {
    return { error: result.error };
  }
  for (const requestId of stats.requestIds) {
    deleteStoredRequest(workspaceRoot, collectionId, requestId);
  }
  const collection = persistTreeMutation(workspaceRoot, collectionId, result.tree);
  return { collection };
}

export function createRequestInStorage(
  workspaceRoot: string,
  collectionId: string,
  parentFolderId: string | null,
  name?: string
): { collection?: Collection; requestId?: string; error?: string } {
  const metadata = loadCollectionMetadata(workspaceRoot, collectionId);
  if (!metadata) {
    return { error: 'Collection not found.' };
  }
  if (metadata.type === 'generated') {
    return { error: 'Cannot create requests in the generated collection.' };
  }

  const displayName = name?.trim() || 'New Request';
  if (!displayName) {
    return { error: 'Request name cannot be empty.' };
  }

  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const request: CollectionRequest = {
    id: requestId,
    displayName,
    method: 'GET',
    url: '{{baseUrl}}/',
    path: '/',
    headers: buildDefaultHeaders(),
    queryParams: [],
  };

  saveStoredRequest(workspaceRoot, collectionId, toStoredRequest(request, workspaceRoot));
  const tree = loadTree(workspaceRoot, collectionId);
  const result = insertRequestAt(tree, requestId, parentFolderId);
  if (!result.ok) {
    deleteStoredRequest(workspaceRoot, collectionId, requestId);
    return { error: result.error };
  }
  const collection = persistTreeMutation(workspaceRoot, collectionId, result.tree);
  return { collection, requestId };
}

export function moveTreeNodeInStorage(
  workspaceRoot: string,
  collectionId: string,
  nodeId: string,
  nodeType: 'folder' | 'request',
  targetFolderId: string | null,
  insertBeforeId?: string
): { collection?: Collection; error?: string } {
  const tree = loadTree(workspaceRoot, collectionId);
  let result;
  if (targetFolderId === null) {
    result = nodeType === 'request'
      ? moveRequest(tree, nodeId, null, insertBeforeId)
      : moveFolder(tree, nodeId, null, insertBeforeId);
  } else if (targetFolderId === nodeId) {
    return { error: 'Cannot drop an item onto itself.' };
  } else {
    result =
      nodeType === 'request'
        ? moveRequest(tree, nodeId, targetFolderId, insertBeforeId)
        : moveFolder(tree, nodeId, targetFolderId, insertBeforeId);
  }
  if (!result.ok) {
    return { error: result.error };
  }
  const collection = persistTreeMutation(workspaceRoot, collectionId, result.tree);
  return { collection };
}

export function reorderTreeNodeInStorage(
  workspaceRoot: string,
  collectionId: string,
  parentFolderId: string | null,
  nodeId: string,
  nodeType: 'folder' | 'request',
  insertBeforeId?: string
): { collection?: Collection; error?: string } {
  const tree = loadTree(workspaceRoot, collectionId);
  const result =
    parentFolderId === null
      ? reorderRoot(tree, nodeId, nodeType, insertBeforeId)
      : reorderInFolder(tree, parentFolderId, nodeId, nodeType, insertBeforeId);
  if (!result.ok) {
    return { error: result.error };
  }
  const collection = persistTreeMutation(workspaceRoot, collectionId, result.tree);
  return { collection };
}

export function deleteCollectionFile(workspaceRoot: string, id: string): void {
  const dir = collectionDir(workspaceRoot, id);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  const index = loadCollectionsIndex(workspaceRoot);
  removeIndexEntry(index, id);
  saveCollectionsIndex(workspaceRoot, index);
}

export function nextUserCollectionId(workspaceRoot: string): string {
  ensureApiscopeLayout(workspaceRoot);
  const index = loadCollectionsIndex(workspaceRoot);
  const existing = index.collections
    .map((c) => {
      const m = c.id.match(/^collection-(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => !Number.isNaN(n) && n > 0);
  const next = existing.length ? Math.max(...existing) + 1 : 1;
  return `collection-${String(next).padStart(3, '0')}`;
}

// ── Environments ──────────────────────────────────────────────────────────────

const ENV_INDEX_FILE = 'index.json';
const ENV_FILE = 'environment.json';

function envIndexPath(workspaceRoot: string): string {
  return path.join(environmentsDir(workspaceRoot), ENV_INDEX_FILE);
}

function environmentDir(workspaceRoot: string, id: string): string {
  return path.join(environmentsDir(workspaceRoot), id);
}

interface LegacyEnvironment {
  id: string;
  name: string;
  /** Legacy: generated | user. New files use `source`. */
  type?: EnvironmentSource | EnvironmentTier;
  source?: EnvironmentSource;
  environmentType?: EnvironmentTier;
  variables?: Array<{ key?: string; name?: string; value: string; sensitive?: boolean; secret?: boolean }>;
  customColor?: string;
}

const ENVIRONMENT_TIER_SET = new Set<EnvironmentTier>([
  'LOCAL',
  'DEV',
  'UAT',
  'STAGING',
  'PROD',
  'CUSTOM',
]);

function isEnvironmentSource(value: string | undefined): value is EnvironmentSource {
  return value === 'generated' || value === 'user';
}

function isEnvironmentTier(value: string | undefined): value is EnvironmentTier {
  return value !== undefined && ENVIRONMENT_TIER_SET.has(value as EnvironmentTier);
}

function inferEnvironmentSource(id: string, explicit?: EnvironmentSource): EnvironmentSource {
  if (explicit) {
    return explicit;
  }
  return id === GENERATED_ENVIRONMENT_ID ? 'generated' : 'user';
}

function defaultEnvironmentTier(id: string, source: EnvironmentSource): EnvironmentTier {
  if (source === 'generated' || id === GENERATED_ENVIRONMENT_ID) {
    return 'LOCAL';
  }
  return 'CUSTOM';
}

function parseEnvironmentIdentity(
  id: string,
  raw: Pick<LegacyEnvironment, 'type' | 'source' | 'environmentType'>
): { source: EnvironmentSource; environmentType: EnvironmentTier } {
  if (raw.source && raw.environmentType) {
    return {
      source: raw.source,
      environmentType: raw.environmentType,
    };
  }

  if (isEnvironmentSource(raw.type)) {
    const source = inferEnvironmentSource(id, raw.type);
    return {
      source,
      environmentType: raw.environmentType ?? defaultEnvironmentTier(id, source),
    };
  }

  if (isEnvironmentTier(raw.type)) {
    const source = inferEnvironmentSource(id, raw.source);
    return { source, environmentType: raw.type };
  }

  const source = inferEnvironmentSource(id, raw.source);
  return {
    source,
    environmentType: raw.environmentType ?? defaultEnvironmentTier(id, source),
  };
}

function migrateEnvironmentId(oldId: string): string {
  if (oldId === 'default') {
    return GENERATED_ENVIRONMENT_ID;
  }
  const match = oldId.match(/^env-(\d+)$/);
  if (match) {
    return `environment-${match[1].padStart(3, '0')}`;
  }
  return oldId;
}

function normalizeEnvironmentVariables(
  variables: Array<{ key?: string; name?: string; value: string; sensitive?: boolean; secret?: boolean }> = []
): EnvironmentVariable[] {
  return variables
    .map((v) => ({
      name: (v.name ?? v.key ?? '').trim(),
      value: v.value,
      ...(v.sensitive || v.secret ? { sensitive: true } : {}),
    }))
    .filter((v) => v.name);
}

function normalizeGeneratedEnvironmentName(name: string): string {
  if (name === 'Default Environment' || name === 'Default') {
    return 'Generated Environment';
  }
  return name;
}

function migrateLegacyEnvironment(env: LegacyEnvironment): Environment {
  const id = migrateEnvironmentId(env.id);
  const { source, environmentType } = parseEnvironmentIdentity(id, env);
  return {
    id,
    name:
      id === GENERATED_ENVIRONMENT_ID
        ? normalizeGeneratedEnvironmentName(env.name)
        : env.name,
    source,
    environmentType,
    variables: normalizeEnvironmentVariables(env.variables),
    ...(env.customColor ? { customColor: env.customColor } : {}),
  };
}

function migrateActiveEnvironmentId(workspaceRoot: string): void {
  const config = loadConfigRaw(workspaceRoot);
  const migrated = migrateEnvironmentId(config.activeEnvironmentId);
  if (migrated !== config.activeEnvironmentId) {
    saveConfigRaw(workspaceRoot, { ...config, activeEnvironmentId: migrated });
  }
}

function sortEnvironmentIndex(index: EnvironmentsIndex): EnvironmentsIndex {
  index.environments.sort((a, b) => {
    if (a.source === 'generated') {
      return -1;
    }
    if (b.source === 'generated') {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
  return index;
}

function normalizeEnvironmentIndexEntry(entry: EnvironmentIndexEntry): EnvironmentIndexEntry {
  const source = inferEnvironmentSource(entry.id, entry.source);
  return {
    id: entry.id,
    name: entry.name,
    source,
    environmentType: entry.environmentType ?? defaultEnvironmentTier(entry.id, source),
  };
}

function normalizeEnvironmentRecord(env: Environment): Environment {
  const source = inferEnvironmentSource(env.id, env.source);
  return {
    ...env,
    source,
    environmentType: env.environmentType ?? defaultEnvironmentTier(env.id, source),
    variables: normalizeEnvironmentVariables(env.variables),
  };
}

function upsertEnvironmentIndexEntry(
  index: EnvironmentsIndex,
  entry: EnvironmentIndexEntry
): void {
  const idx = index.environments.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    index.environments[idx] = entry;
  } else {
    index.environments.push(entry);
  }
}

function removeEnvironmentIndexEntry(index: EnvironmentsIndex, id: string): void {
  index.environments = index.environments.filter((e) => e.id !== id);
}

function migrateFlatEnvironments(workspaceRoot: string): void {
  const dir = environmentsDir(workspaceRoot);
  if (fs.existsSync(envIndexPath(workspaceRoot))) {
    return;
  }

  const flat = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== ENV_INDEX_FILE);
  if (flat.length === 0) {
    writeJson(envIndexPath(workspaceRoot), { environments: [] });
    return;
  }

  writeJson(envIndexPath(workspaceRoot), { environments: [] });

  const index: EnvironmentsIndex = { environments: [] };
  for (const file of flat) {
    const raw = readJson<LegacyEnvironment | undefined>(path.join(dir, file), undefined);
    if (!raw) {
      continue;
    }
    persistEnvironment(workspaceRoot, migrateLegacyEnvironment(raw), index);
    try {
      fs.unlinkSync(path.join(dir, file));
    } catch {
      // non-fatal
    }
  }

  saveEnvironmentsIndex(workspaceRoot, sortEnvironmentIndex(index));
  migrateActiveEnvironmentId(workspaceRoot);
}

export function loadEnvironmentsIndex(workspaceRoot: string): EnvironmentsIndex {
  ensureApiscopeLayout(workspaceRoot);
  const index = readJson<EnvironmentsIndex>(envIndexPath(workspaceRoot), { environments: [] });
  return {
    environments: index.environments.map((entry) => {
      const legacy = entry as EnvironmentIndexEntry & { type?: EnvironmentSource | EnvironmentTier };
      if (legacy.type !== undefined && legacy.source === undefined) {
        const { source, environmentType } = parseEnvironmentIdentity(entry.id, legacy);
        return { id: entry.id, name: entry.name, source, environmentType };
      }
      return normalizeEnvironmentIndexEntry(entry);
    }),
  };
}

export function saveEnvironmentsIndex(workspaceRoot: string, index: EnvironmentsIndex): void {
  ensureDir(environmentsDir(workspaceRoot));
  writeJson(envIndexPath(workspaceRoot), index);
}

export function loadEnvironment(workspaceRoot: string, id: string): Environment | undefined {
  const file = path.join(environmentDir(workspaceRoot, id), ENV_FILE);
  if (!fs.existsSync(file)) {
    return undefined;
  }
  let env = readJson<Environment | LegacyEnvironment | undefined>(file, undefined);
  if (!env) {
    return undefined;
  }
  const legacy = env as LegacyEnvironment;
  if (legacy.type !== undefined && legacy.source === undefined) {
    env = migrateLegacyEnvironment(legacy);
    persistEnvironment(workspaceRoot, env);
  } else {
    env = normalizeEnvironmentRecord(env as Environment);
  }
  env = {
    ...env,
    variables: normalizeEnvironmentVariables(env.variables),
  };
  if (env.id === GENERATED_ENVIRONMENT_ID && env.name !== GENERATED_ENVIRONMENT_NAME) {
    env = { ...env, name: GENERATED_ENVIRONMENT_NAME };
    persistEnvironment(workspaceRoot, env);
  }
  return env;
}

export function loadAllEnvironments(workspaceRoot: string): Environment[] {
  ensureApiscopeLayout(workspaceRoot);
  const index = loadEnvironmentsIndex(workspaceRoot);
  const environments: Environment[] = [];
  for (const entry of index.environments) {
    const env = loadEnvironment(workspaceRoot, entry.id);
    if (env) {
      environments.push(env);
    }
  }
  return sortEnvironmentIndex({ environments: index.environments }).environments
    .map((entry) => environments.find((e) => e.id === entry.id))
    .filter((e): e is Environment => e !== undefined);
}

export function persistEnvironment(
  workspaceRoot: string,
  environment: Environment,
  index?: EnvironmentsIndex
): void {
  ensureDir(environmentsDir(workspaceRoot));
  ensureDir(environmentDir(workspaceRoot, environment.id));
  writeJson(path.join(environmentDir(workspaceRoot, environment.id), ENV_FILE), environment);

  const envIndex = index ?? loadEnvironmentsIndex(workspaceRoot);
  upsertEnvironmentIndexEntry(envIndex, {
    id: environment.id,
    name: environment.name,
    source: environment.source,
    environmentType: environment.environmentType,
  });
  saveEnvironmentsIndex(workspaceRoot, sortEnvironmentIndex(envIndex));
}

export function saveEnvironment(workspaceRoot: string, environment: Environment): void {
  persistEnvironment(workspaceRoot, environment);
}

export function renameEnvironmentMetadata(
  workspaceRoot: string,
  environmentId: string,
  name: string
): void {
  const env = loadEnvironment(workspaceRoot, environmentId);
  if (!env) {
    return;
  }
  persistEnvironment(workspaceRoot, { ...env, name });

  const index = loadEnvironmentsIndex(workspaceRoot);
  upsertEnvironmentIndexEntry(index, {
    id: environmentId,
    name,
    source: env.source,
    environmentType: env.environmentType,
  });
  saveEnvironmentsIndex(workspaceRoot, index);
}

export function deleteEnvironmentFile(workspaceRoot: string, id: string): void {
  const dir = environmentDir(workspaceRoot, id);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  const index = loadEnvironmentsIndex(workspaceRoot);
  removeEnvironmentIndexEntry(index, id);
  saveEnvironmentsIndex(workspaceRoot, index);
}

export function nextEnvironmentId(workspaceRoot: string): string {
  const index = loadEnvironmentsIndex(workspaceRoot);
  const existing = index.environments
    .map((e) => {
      const m = e.id.match(/^environment-(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => !Number.isNaN(n) && n > 0);
  const next = existing.length ? Math.max(...existing) + 1 : 1;
  return `environment-${String(next).padStart(3, '0')}`;
}

// ── Scans ─────────────────────────────────────────────────────────────────────

export function saveLastScan(workspaceRoot: string, record: LastScanRecord): void {
  ensureApiscopeLayout(workspaceRoot);
  writeJson(path.join(scansDir(workspaceRoot), LAST_SCAN_FILE), record);
}

export function loadLastScan(workspaceRoot: string): LastScanRecord | undefined {
  ensureApiscopeLayout(workspaceRoot);
  const file = path.join(scansDir(workspaceRoot), LAST_SCAN_FILE);
  return readJson<LastScanRecord | undefined>(file, undefined);
}

/** @deprecated Use collection folder paths instead. Kept for compatibility. */
export function collectionFileName(id: string): string {
  return `${id}.json`;
}

export { toRelativePath };

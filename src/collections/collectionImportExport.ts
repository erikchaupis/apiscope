import {
  Collection,
  CollectionRequest,
  StoredRequest,
  TreeDocument,
} from '../core/types';
import { controllersToTree, remapTreeIds, treeToControllers } from '../storage/treeAdapter';
import { serializeCollectionRequest } from '../storage/ApiScopeStorage';

export const COLLECTION_EXPORT_SPEC_VERSION = '1';
export const COLLECTION_EXPORT_EXTENSION = '.apiscope.json';

export interface CollectionExportPayload {
  id: string;
  name: string;
  type: Collection['type'];
  createdAt: string;
  updatedAt: string;
  isDirty?: boolean;
  tree: TreeDocument;
  requests: Record<string, StoredRequest>;
}

export interface CollectionExportDocument {
  specVersion: typeof COLLECTION_EXPORT_SPEC_VERSION;
  exportedAt: string;
  collection: CollectionExportPayload;
}

export function suggestedCollectionExportFileName(collectionName: string): string {
  const slug =
    collectionName
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'collection';
  return `${slug}${COLLECTION_EXPORT_EXTENSION}`;
}

export function resolveImportedCollectionName(
  originalName: string,
  existingNames: string[]
): string {
  const trimmed = originalName.trim() || 'Imported Collection';
  const taken = new Set(existingNames);

  if (!taken.has(trimmed)) {
    return trimmed;
  }

  const firstCandidate = `${trimmed} (Imported)`;
  if (!taken.has(firstCandidate)) {
    return firstCandidate;
  }

  let index = 2;
  while (taken.has(`${trimmed} (Imported ${index})`)) {
    index += 1;
  }
  return `${trimmed} (Imported ${index})`;
}

export function buildCollectionExportDocument(
  collection: Collection,
  workspaceRoot: string
): CollectionExportDocument {
  const tree = collection.tree ?? controllersToTree(collection.controllers);
  const requests: Record<string, StoredRequest> = {};

  for (const group of collection.controllers) {
    for (const request of group.requests) {
      const stored = serializeCollectionRequest(request, workspaceRoot);
      requests[request.id] = {
        ...stored,
        sourceKey: undefined,
      };
    }
  }

  return {
    specVersion: COLLECTION_EXPORT_SPEC_VERSION,
    exportedAt: new Date().toISOString(),
    collection: {
      id: collection.id,
      name: collection.name,
      type: collection.type,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
      isDirty: collection.isDirty,
      tree,
      requests,
    },
  };
}

function storedRequestToCollectionRequest(
  stored: StoredRequest,
  requestId: string
): CollectionRequest {
  return {
    id: requestId,
    displayName: stored.displayName,
    displayNameOverride: stored.displayNameOverride,
    name: stored.name,
    method: stored.method,
    url: stored.url,
    headers: stored.headers,
    queryParams: stored.queryParams,
    path: stored.path,
    body: stored.body,
    requestBody: stored.requestBody,
    captureResponse: stored.captureResponse,
    authorization: stored.authorization,
    automation: stored.automation,
    ui: stored.ui,
  };
}

function newImportFolderId(): string {
  return `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function newImportRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function materializeImportedCollection(
  document: CollectionExportDocument,
  newCollectionId: string,
  name: string
): Collection {
  const source = document.collection;
  const folderIdMap = new Map<string, string>();
  const requestIdMap = new Map<string, string>();

  for (const folderId of Object.keys(source.tree.nodes)) {
    folderIdMap.set(folderId, newImportFolderId());
  }
  for (const requestId of Object.keys(source.requests)) {
    requestIdMap.set(requestId, newImportRequestId());
  }

  const tree = remapTreeIds(source.tree, folderIdMap, requestIdMap);
  const requestMap = new Map<string, CollectionRequest>();

  for (const [oldId, stored] of Object.entries(source.requests)) {
    const newRequestId = requestIdMap.get(oldId);
    if (!newRequestId) {
      continue;
    }
    requestMap.set(newRequestId, storedRequestToCollectionRequest(stored, newRequestId));
  }

  const now = new Date().toISOString();
  const controllers = treeToControllers(tree, requestMap);

  return {
    id: newCollectionId,
    name,
    type: 'user',
    createdAt: now,
    updatedAt: now,
    isDirty: false,
    controllers,
    tree,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTreeDocument(value: unknown): value is TreeDocument {
  if (!isRecord(value)) {
    return false;
  }
  return Array.isArray(value.root) && isRecord(value.nodes);
}

export function parseCollectionExportDocument(raw: string): CollectionExportDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid collection file: not valid JSON.');
  }

  if (!isRecord(parsed)) {
    throw new Error('Invalid collection file: expected a JSON object.');
  }

  if (parsed.specVersion !== COLLECTION_EXPORT_SPEC_VERSION) {
    throw new Error('Unsupported collection file version.');
  }

  const collection = parsed.collection;
  if (!isRecord(collection)) {
    throw new Error('Invalid collection file: missing collection data.');
  }

  if (typeof collection.name !== 'string' || !collection.name.trim()) {
    throw new Error('Invalid collection file: collection name is required.');
  }

  if (!isTreeDocument(collection.tree)) {
    throw new Error('Invalid collection file: collection tree is malformed.');
  }

  if (!isRecord(collection.requests)) {
    throw new Error('Invalid collection file: collection requests are malformed.');
  }

  const requests: Record<string, StoredRequest> = {};
  for (const [requestId, requestValue] of Object.entries(collection.requests)) {
    if (!isRecord(requestValue)) {
      throw new Error(`Invalid collection file: request "${requestId}" is malformed.`);
    }
    if (typeof requestValue.method !== 'string' || typeof requestValue.url !== 'string') {
      throw new Error(`Invalid collection file: request "${requestId}" is missing required fields.`);
    }
    requests[requestId] = requestValue as StoredRequest;
  }

  return {
    specVersion: COLLECTION_EXPORT_SPEC_VERSION,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    collection: {
      id: typeof collection.id === 'string' ? collection.id : 'imported-collection',
      name: collection.name.trim(),
      type: collection.type === 'generated' ? 'generated' : 'user',
      createdAt: typeof collection.createdAt === 'string' ? collection.createdAt : new Date().toISOString(),
      updatedAt: typeof collection.updatedAt === 'string' ? collection.updatedAt : new Date().toISOString(),
      isDirty: typeof collection.isDirty === 'boolean' ? collection.isDirty : undefined,
      tree: collection.tree,
      requests,
    },
  };
}

export function serializeCollectionExportDocument(document: CollectionExportDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

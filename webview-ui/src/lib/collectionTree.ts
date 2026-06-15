import type { Collection, CollectionRequest, TreeDocument, TreeRef } from '../types';
import { resolveCollectionRequestDisplayName } from './requestDisplayName';

export function buildRequestMap(collection: Collection): Map<string, CollectionRequest> {
  const map = new Map<string, CollectionRequest>();
  for (const group of collection.controllers) {
    for (const req of group.requests) {
      map.set(req.id, req);
    }
  }
  return map;
}

export function getTreeChildren(tree: TreeDocument, parentFolderId: string | null): TreeRef[] {
  if (parentFolderId === null) {
    return tree.root;
  }
  const node = tree.nodes[parentFolderId];
  if (!node) {
    return [];
  }
  return node.children.map((id) => ({
    id,
    type: tree.nodes[id] ? 'folder' : 'request',
  }));
}

/** Root-level folder refs, including folders only present in tree.nodes. */
export function getRootFolderRefs(tree: TreeDocument): TreeRef[] {
  const nestedFolderIds = new Set<string>();
  for (const node of Object.values(tree.nodes)) {
    for (const childId of node.children) {
      if (tree.nodes[childId]) {
        nestedFolderIds.add(childId);
      }
    }
  }

  const refs: TreeRef[] = [];
  const seen = new Set<string>();

  for (const ref of tree.root) {
    if (tree.nodes[ref.id] || ref.type === 'folder') {
      refs.push({ id: ref.id, type: 'folder' });
      seen.add(ref.id);
    }
  }

  for (const folderId of Object.keys(tree.nodes)) {
    if (!nestedFolderIds.has(folderId) && !seen.has(folderId)) {
      refs.push({ id: folderId, type: 'folder' });
    }
  }

  return refs;
}

export function getFolderChildren(tree: TreeDocument, folderId: string): TreeRef[] {
  return getTreeChildren(tree, folderId).filter(
    (ref) => ref.type === 'folder' || Boolean(tree.nodes[ref.id])
  );
}

export function countRequestsInFolder(tree: TreeDocument, folderId: string): number {
  const node = tree.nodes[folderId];
  if (!node) {
    return 0;
  }
  let count = 0;
  for (const childId of node.children) {
    if (tree.nodes[childId]) {
      count += countRequestsInFolder(tree, childId);
    } else {
      count += 1;
    }
  }
  return count;
}

export function countCollectionRequests(tree: TreeDocument): number {
  let count = 0;
  function walkRefs(refs: TreeRef[]): void {
    for (const ref of refs) {
      if (ref.type === 'request') {
        count += 1;
      } else {
        count += countRequestsInFolder(tree, ref.id);
      }
    }
  }
  walkRefs(tree.root);
  return count;
}

export function findFolderIdsForRequest(tree: TreeDocument, requestId: string): string[] {
  const path: string[] = [];

  function walkFolder(folderId: string): boolean {
    const node = tree.nodes[folderId];
    if (!node) {
      return false;
    }
    for (const childId of node.children) {
      if (childId === requestId) {
        path.push(folderId);
        return true;
      }
      if (tree.nodes[childId] && walkFolder(childId)) {
        path.unshift(folderId);
        return true;
      }
    }
    return false;
  }

  if (tree.root.some((r) => r.type === 'request' && r.id === requestId)) {
    return [];
  }

  for (const item of tree.root) {
    if (item.type === 'folder' && walkFolder(item.id)) {
      break;
    }
  }

  return path;
}

export function isFolderAncestor(
  tree: TreeDocument,
  ancestorId: string,
  candidateId: string
): boolean {
  if (ancestorId === candidateId) {
    return true;
  }
  const node = tree.nodes[ancestorId];
  if (!node) {
    return false;
  }
  for (const childId of node.children) {
    if (tree.nodes[childId] && isFolderAncestor(tree, childId, candidateId)) {
      return true;
    }
  }
  return false;
}

export function findFolderParentId(tree: TreeDocument, folderId: string): string | null {
  if (tree.root.some((r) => r.type === 'folder' && r.id === folderId)) {
    return null;
  }
  for (const [parentId, node] of Object.entries(tree.nodes)) {
    if (node.children.includes(folderId)) {
      return parentId;
    }
  }
  return null;
}

export function findRequestParentId(tree: TreeDocument, requestId: string): string | null {
  if (tree.root.some((r) => r.type === 'request' && r.id === requestId)) {
    return null;
  }
  for (const [folderId, node] of Object.entries(tree.nodes)) {
    if (node.children.includes(requestId) && !tree.nodes[requestId]) {
      return folderId;
    }
  }
  return null;
}

export function countSubfoldersInFolder(tree: TreeDocument, folderId: string): number {
  let count = 0;
  for (const childId of tree.nodes[folderId]?.children ?? []) {
    if (tree.nodes[childId]) {
      count += 1 + countSubfoldersInFolder(tree, childId);
    }
  }
  return count;
}

export function requestLabel(req: CollectionRequest): string {
  return resolveCollectionRequestDisplayName(req);
}

/** True when the request was discovered by the scanner (not manually created). */
export function hasScannedSource(req: CollectionRequest): boolean {
  return Boolean(req.sourceKey);
}

export function validateCollectionName(
  name: string,
  collections: Collection[],
  excludeId?: string
): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Collection name cannot be empty.';
  }
  if (trimmed.length > 100) {
    return 'Collection name must be 100 characters or fewer.';
  }
  if (
    collections.some(
      (c) => c.id !== excludeId && c.name.toLowerCase() === trimmed.toLowerCase()
    )
  ) {
    return 'A collection with this name already exists.';
  }
  return undefined;
}

export function validateFolderName(
  tree: TreeDocument,
  name: string,
  parentFolderId: string | null,
  excludeFolderId?: string
): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Folder name cannot be empty.';
  }
  if (trimmed.length > 100) {
    return 'Folder name must be 100 characters or fewer.';
  }
  const lower = trimmed.toLowerCase();
  const siblings = getSiblingFolderNames(tree, parentFolderId, excludeFolderId);
  if (siblings.includes(lower)) {
    return 'A folder with this name already exists here.';
  }
  return undefined;
}

export function nextAvailableFolderName(
  tree: TreeDocument,
  parentFolderId: string | null,
  baseName = 'New Folder'
): string {
  let name = baseName;
  let n = 2;
  while (validateFolderName(tree, name, parentFolderId)) {
    name = `${baseName} ${n++}`;
  }
  return name;
}

export function nextAvailableCollectionName(
  collections: Collection[],
  baseName = 'New Collection'
): string {
  let name = baseName;
  let n = 2;
  while (validateCollectionName(name, collections)) {
    name = `${baseName} ${n++}`;
  }
  return name;
}

export function validateRequestName(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Request name cannot be empty.';
  }
  if (trimmed.length > 100) {
    return 'Request name must be 100 characters or fewer.';
  }
  return undefined;
}

function getSiblingFolderNames(
  tree: TreeDocument,
  parentFolderId: string | null,
  excludeFolderId?: string
): string[] {
  if (parentFolderId === null) {
    return tree.root
      .filter((r) => r.type === 'folder' && r.id !== excludeFolderId)
      .map((r) => tree.nodes[r.id]?.name.toLowerCase())
      .filter((n): n is string => Boolean(n));
  }
  return (tree.nodes[parentFolderId]?.children ?? [])
    .filter((id) => tree.nodes[id] && id !== excludeFolderId)
    .map((id) => tree.nodes[id].name.toLowerCase());
}

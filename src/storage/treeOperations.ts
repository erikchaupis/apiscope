import { FolderNode, TreeDocument, TreeRef } from '../core/types';
import { collectRequestIdsFromTree } from './treeAdapter';

export type TreeMutationResult =
  | { ok: true; tree: TreeDocument; folderId?: string }
  | { ok: false; error: string };

export interface FolderDeleteStats {
  requestCount: number;
  subfolderCount: number;
  requestIds: string[];
}

function folderIdForName(name: string): string {
  const slug = name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `folder-${slug || 'root'}`;
}

function allFolderIds(tree: TreeDocument): Set<string> {
  return new Set(Object.keys(tree.nodes));
}

function generateFolderId(name: string, existing: Set<string>): string {
  let id = folderIdForName(name);
  let n = 2;
  while (existing.has(id)) {
    id = `${folderIdForName(name)}-${n++}`;
  }
  return id;
}

function siblingFolderNames(tree: TreeDocument, parentFolderId: string | null): string[] {
  if (parentFolderId === null) {
    return tree.root
      .filter((r) => r.type === 'folder')
      .map((r) => tree.nodes[r.id]?.name.toLowerCase())
      .filter((n): n is string => Boolean(n));
  }
  return (tree.nodes[parentFolderId]?.children ?? [])
    .filter((id) => tree.nodes[id])
    .map((id) => tree.nodes[id].name.toLowerCase());
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
  const siblings = siblingFolderNames(tree, parentFolderId);
  if (excludeFolderId) {
    const excludedName = tree.nodes[excludeFolderId]?.name.toLowerCase();
    if (siblings.filter((n) => n !== excludedName).includes(lower)) {
      return 'A folder with this name already exists here.';
    }
    return undefined;
  }
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

export function countSubfoldersInFolder(tree: TreeDocument, folderId: string): number {
  const node = tree.nodes[folderId];
  if (!node) {
    return 0;
  }
  let count = 0;
  for (const childId of node.children) {
    if (tree.nodes[childId]) {
      count += 1 + countSubfoldersInFolder(tree, childId);
    }
  }
  return count;
}

export function collectFolderDeleteStats(
  tree: TreeDocument,
  folderId: string
): FolderDeleteStats {
  const requestIds: string[] = [];

  function walk(id: string): void {
    const node = tree.nodes[id];
    if (!node) {
      return;
    }
    for (const childId of node.children) {
      if (tree.nodes[childId]) {
        walk(childId);
      } else {
        requestIds.push(childId);
      }
    }
  }

  walk(folderId);
  return {
    requestCount: requestIds.length,
    subfolderCount: countSubfoldersInFolder(tree, folderId),
    requestIds,
  };
}

export function countCollectionRequests(tree: TreeDocument): number {
  return collectRequestIdsFromTree(tree).size;
}

function detachNodeFromTree(tree: TreeDocument, id: string): TreeDocument {
  const root = tree.root.filter((item) => item.id !== id);
  const nodes: Record<string, FolderNode> = {};
  for (const [nodeId, node] of Object.entries(tree.nodes)) {
    nodes[nodeId] = {
      ...node,
      children: node.children.filter((childId) => childId !== id),
    };
  }
  return { root, nodes };
}

function removeIdFromTree(tree: TreeDocument, id: string): TreeDocument {
  const root = tree.root.filter((item) => item.id !== id);
  const nodes: Record<string, FolderNode> = {};
  for (const [nodeId, node] of Object.entries(tree.nodes)) {
    if (nodeId === id) {
      continue;
    }
    nodes[nodeId] = {
      ...node,
      children: node.children.filter((childId) => childId !== id),
    };
  }
  return { root, nodes };
}

function appendToParent(
  tree: TreeDocument,
  parentFolderId: string | null,
  childRef: TreeRef,
  insertBeforeId?: string
): TreeDocument {
  if (parentFolderId === null) {
    const root = [...tree.root];
    if (insertBeforeId) {
      const idx = root.findIndex((r) => r.id === insertBeforeId);
      if (idx >= 0) {
        root.splice(idx, 0, childRef);
      } else {
        root.push(childRef);
      }
    } else {
      root.push(childRef);
    }
    return { ...tree, root };
  }

  const parent = tree.nodes[parentFolderId];
  if (!parent) {
    return tree;
  }
  const children = [...parent.children];
  if (insertBeforeId) {
    const idx = children.indexOf(insertBeforeId);
    if (idx >= 0) {
      children.splice(idx, 0, childRef.id);
    } else {
      children.push(childRef.id);
    }
  } else {
    children.push(childRef.id);
  }
  return {
    ...tree,
    nodes: { ...tree.nodes, [parentFolderId]: { ...parent, children } },
  };
}

export function createFolder(
  tree: TreeDocument,
  parentFolderId: string | null,
  name: string
): TreeMutationResult {
  const trimmed = name.trim();
  const error = validateFolderName(tree, trimmed, parentFolderId);
  if (error) {
    return { ok: false, error };
  }
  if (parentFolderId && !tree.nodes[parentFolderId]) {
    return { ok: false, error: 'Parent folder not found.' };
  }

  const folderId = generateFolderId(trimmed, allFolderIds(tree));
  const next: TreeDocument = {
    ...tree,
    root:
      parentFolderId === null
        ? [...tree.root, { id: folderId, type: 'folder' }]
        : tree.root,
    nodes: {
      ...tree.nodes,
      [folderId]: { id: folderId, type: 'folder', name: trimmed, children: [] },
    },
  };

  if (parentFolderId !== null) {
    const parent = next.nodes[parentFolderId];
    next.nodes[parentFolderId] = {
      ...parent,
      children: [...parent.children, folderId],
    };
  }

  return { ok: true, tree: next, folderId };
}

export function renameFolder(
  tree: TreeDocument,
  folderId: string,
  name: string
): TreeMutationResult {
  const node = tree.nodes[folderId];
  if (!node) {
    return { ok: false, error: 'Folder not found.' };
  }
  const parentId = findFolderParentId(tree, folderId);
  const error = validateFolderName(tree, name, parentId, folderId);
  if (error) {
    return { ok: false, error };
  }
  return {
    ok: true,
    tree: {
      ...tree,
      nodes: { ...tree.nodes, [folderId]: { ...node, name: name.trim() } },
    },
  };
}

export function deleteFolder(tree: TreeDocument, folderId: string): TreeMutationResult {
  if (!tree.nodes[folderId]) {
    return { ok: false, error: 'Folder not found.' };
  }
  let next = { ...tree };
  const toRemove = new Set<string>();

  function collectFolders(id: string): void {
    toRemove.add(id);
    for (const childId of next.nodes[id]?.children ?? []) {
      if (next.nodes[childId]) {
        collectFolders(childId);
      }
    }
  }
  collectFolders(folderId);

  for (const id of toRemove) {
    next = removeIdFromTree(next, id);
  }

  return { ok: true, tree: next };
}

export function findFolderParentId(tree: TreeDocument, folderId: string): string | null {
  if (tree.root.some((r) => r.type === 'folder' && r.id === folderId)) {
    return null;
  }
  for (const [parentId, node] of Object.entries(tree.nodes)) {
    if (node.children.includes(folderId) && tree.nodes[folderId]) {
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

export function insertRequestAt(
  tree: TreeDocument,
  requestId: string,
  parentFolderId: string | null,
  insertBeforeId?: string
): TreeMutationResult {
  if (collectRequestIdsFromTree(tree).has(requestId)) {
    return { ok: false, error: 'Request already exists in tree.' };
  }
  if (parentFolderId !== null && !tree.nodes[parentFolderId]) {
    return { ok: false, error: 'Parent folder not found.' };
  }

  const ref: TreeRef = { id: requestId, type: 'request' };
  if (parentFolderId === null) {
    const root = [...tree.root];
    if (insertBeforeId) {
      const idx = root.findIndex((r) => r.id === insertBeforeId);
      if (idx >= 0) {
        root.splice(idx, 0, ref);
      } else {
        root.push(ref);
      }
    } else {
      root.push(ref);
    }
    return { ok: true, tree: { ...tree, root } };
  }

  return { ok: true, tree: appendToParent(tree, parentFolderId, ref, insertBeforeId) };
}

export function moveRequest(
  tree: TreeDocument,
  requestId: string,
  targetFolderId: string | null,
  insertBeforeId?: string
): TreeMutationResult {
  if (insertBeforeId === requestId) {
    return { ok: true, tree };
  }

  let next = detachNodeFromTree(tree, requestId);
  const ref: TreeRef = { id: requestId, type: 'request' };

  if (targetFolderId === null) {
    const root = [...next.root];
    if (insertBeforeId) {
      const idx = root.findIndex((r) => r.id === insertBeforeId);
      if (idx >= 0) {
        root.splice(idx, 0, ref);
      } else {
        root.push(ref);
      }
    } else {
      root.push(ref);
    }
    return { ok: true, tree: { ...next, root } };
  }

  if (!next.nodes[targetFolderId]) {
    return { ok: false, error: 'Target folder not found.' };
  }

  next = appendToParent(next, targetFolderId, ref, insertBeforeId);
  return { ok: true, tree: next };
}

export function moveFolder(
  tree: TreeDocument,
  folderId: string,
  targetFolderId: string | null,
  insertBeforeId?: string
): TreeMutationResult {
  if (!tree.nodes[folderId]) {
    return { ok: false, error: 'Folder not found.' };
  }
  if (insertBeforeId === folderId) {
    return { ok: true, tree };
  }
  if (targetFolderId && isFolderAncestor(tree, folderId, targetFolderId)) {
    return { ok: false, error: 'Cannot move a folder into itself or a subfolder.' };
  }

  let next = detachNodeFromTree(tree, folderId);
  const ref: TreeRef = { id: folderId, type: 'folder' };
  next = appendToParent(next, targetFolderId, ref, insertBeforeId);
  return { ok: true, tree: next };
}

export function reorderRoot(
  tree: TreeDocument,
  draggedId: string,
  draggedType: 'folder' | 'request',
  insertBeforeId?: string
): TreeMutationResult {
  if (draggedType === 'request') {
    return moveRequest(tree, draggedId, null, insertBeforeId);
  }
  return moveFolder(tree, draggedId, null, insertBeforeId);
}

export function reorderInFolder(
  tree: TreeDocument,
  folderId: string,
  draggedId: string,
  draggedType: 'folder' | 'request',
  insertBeforeId?: string
): TreeMutationResult {
  if (draggedType === 'request') {
    return moveRequest(tree, draggedId, folderId, insertBeforeId);
  }
  return moveFolder(tree, draggedId, folderId, insertBeforeId);
}

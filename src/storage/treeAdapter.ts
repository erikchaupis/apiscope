import { CollectionRequest, ControllerGroup, FolderNode, TreeDocument, TreeRef } from '../core/types';

function folderIdForName(name: string): string {
  const slug = name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `folder-${slug || 'root'}`;
}

export function controllersToTree(controllers: ControllerGroup[]): TreeDocument {
  const root: TreeRef[] = [];
  const nodes: Record<string, FolderNode> = {};
  const usedIds = new Set<string>();

  for (const group of controllers) {
    let folderId = folderIdForName(group.name);
    let n = 2;
    while (usedIds.has(folderId)) {
      folderId = `${folderIdForName(group.name)}-${n}`;
      n++;
    }
    usedIds.add(folderId);

    root.push({ id: folderId, type: 'folder' });
    nodes[folderId] = {
      id: folderId,
      type: 'folder',
      name: group.name,
      children: group.requests.map((r) => r.id),
    };
  }

  return { root, nodes };
}

function walkFolder(
  folderId: string,
  prefix: string,
  groups: ControllerGroup[],
  tree: TreeDocument,
  requests: Map<string, CollectionRequest>
): void {
  const node = tree.nodes[folderId];
  if (!node) {
    return;
  }

  const groupName = prefix ? `${prefix}/${node.name}` : node.name;
  const directReqs: CollectionRequest[] = [];

  for (const childId of node.children) {
    const req = requests.get(childId);
    if (req) {
      directReqs.push(req);
    } else if (tree.nodes[childId]) {
      walkFolder(childId, groupName, groups, tree, requests);
    }
  }

  if (directReqs.length > 0) {
    groups.push({ name: groupName, requests: directReqs });
  }
}

export function treeToControllers(
  tree: TreeDocument,
  requests: Map<string, CollectionRequest>
): ControllerGroup[] {
  const groups: ControllerGroup[] = [];
  const rootRequests: CollectionRequest[] = [];

  for (const item of tree.root) {
    if (item.type === 'request') {
      const req = requests.get(item.id);
      if (req) {
        rootRequests.push(req);
      }
    } else if (item.type === 'folder') {
      walkFolder(item.id, '', groups, tree, requests);
    }
  }

  if (rootRequests.length > 0) {
    groups.unshift({ name: 'Requests', requests: rootRequests });
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

export function collectRequestIdsFromTree(tree: TreeDocument): Set<string> {
  const ids = new Set<string>();

  function walkChildren(childIds: string[]): void {
    for (const childId of childIds) {
      if (tree.nodes[childId]) {
        walkChildren(tree.nodes[childId].children);
      } else {
        ids.add(childId);
      }
    }
  }

  for (const item of tree.root) {
    if (item.type === 'request') {
      ids.add(item.id);
    } else if (item.type === 'folder') {
      const node = tree.nodes[item.id];
      if (node) {
        walkChildren(node.children);
      }
    }
  }

  return ids;
}

export function removeRequestFromTree(tree: TreeDocument, requestId: string): TreeDocument {
  const root = tree.root.filter((item) => !(item.type === 'request' && item.id === requestId));
  const nodes: Record<string, FolderNode> = {};

  for (const [id, node] of Object.entries(tree.nodes)) {
    nodes[id] = {
      ...node,
      children: node.children.filter((childId) => childId !== requestId),
    };
  }

  return { root, nodes };
}

export function insertRequestInTree(
  tree: TreeDocument,
  requestId: string,
  controllerName: string,
  afterRequestId?: string
): TreeDocument {
  const folderId = folderIdForName(controllerName);
  const existing = tree.nodes[folderId];

  if (existing) {
    if (existing.children.includes(requestId)) {
      return tree;
    }
    const children = [...existing.children];
    if (afterRequestId) {
      const idx = children.indexOf(afterRequestId);
      if (idx >= 0) {
        children.splice(idx + 1, 0, requestId);
      } else {
        children.push(requestId);
      }
    } else {
      children.push(requestId);
    }
    return {
      ...tree,
      nodes: { ...tree.nodes, [folderId]: { ...existing, children } },
    };
  }

  const rootHasFolder = tree.root.some((item) => item.type === 'folder' && item.id === folderId);
  return {
    root: rootHasFolder ? tree.root : [...tree.root, { id: folderId, type: 'folder' }],
    nodes: {
      ...tree.nodes,
      [folderId]: {
        id: folderId,
        type: 'folder',
        name: controllerName,
        children: [requestId],
      },
    },
  };
}

export function remapTreeRequestIds(
  tree: TreeDocument,
  idMap: Map<string, string>
): TreeDocument {
  const root = tree.root.map((ref) =>
    ref.type === 'request'
      ? { ...ref, id: idMap.get(ref.id) ?? ref.id }
      : ref
  );
  const nodes: Record<string, FolderNode> = {};
  for (const [id, node] of Object.entries(tree.nodes)) {
    nodes[id] = {
      ...node,
      children: node.children.map((childId) =>
        tree.nodes[childId] ? childId : idMap.get(childId) ?? childId
      ),
    };
  }
  return { root, nodes };
}

export function remapTreeIds(
  tree: TreeDocument,
  folderIdMap: Map<string, string>,
  requestIdMap: Map<string, string>
): TreeDocument {
  const root = tree.root.map((ref) => {
    if (ref.type === 'request') {
      return { ...ref, id: requestIdMap.get(ref.id) ?? ref.id };
    }
    return { ...ref, id: folderIdMap.get(ref.id) ?? ref.id };
  });

  const nodes: Record<string, FolderNode> = {};
  for (const [oldId, node] of Object.entries(tree.nodes)) {
    const newId = folderIdMap.get(oldId) ?? oldId;
    nodes[newId] = {
      ...node,
      id: newId,
      children: node.children.map((childId) => {
        if (tree.nodes[childId]) {
          return folderIdMap.get(childId) ?? childId;
        }
        return requestIdMap.get(childId) ?? childId;
      }),
    };
  }

  return { root, nodes };
}

export function mergeScanIntoTree(
  existingTree: TreeDocument | undefined,
  controllers: ControllerGroup[],
  removedRequestIds: string[],
  addedRequests: Array<{ request: CollectionRequest; controllerName: string }>
): TreeDocument {
  let tree = existingTree?.root.length || existingTree?.nodes
    ? { ...existingTree!, root: [...existingTree!.root], nodes: { ...existingTree!.nodes } }
    : controllersToTree(controllers);

  for (const id of removedRequestIds) {
    tree = removeRequestFromTree(tree, id);
  }

  const present = collectRequestIdsFromTree(tree);
  for (const { request, controllerName } of addedRequests) {
    if (!present.has(request.id)) {
      tree = insertRequestInTree(tree, request.id, controllerName);
    }
  }

  return tree;
}

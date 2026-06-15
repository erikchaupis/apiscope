import * as vscode from 'vscode';
import { CollectionManager } from '../collections/CollectionManager';
import { EnvironmentManager } from '../environment/EnvironmentManager';
import {
  findRequestParentId,
  isFolderAncestor,
} from '../storage/treeOperations';
import { CollectionTreeItem, CollectionsTreeProvider } from './CollectionsTreeProvider';

const TREE_MIME = 'application/vnd.code.tree.apiscope.collections';

export interface TreeDropMove {
  collectionId: string;
  nodeId: string;
  nodeType: 'folder' | 'request';
  targetFolderId: string | null;
  insertBeforeId?: string;
}

export function resolveTreeDropMove(
  source: CollectionTreeItem,
  target: CollectionTreeItem | undefined,
  collections: Collection[]
): TreeDropMove | undefined {
  if (source.kind !== 'folder' && source.kind !== 'request') {
    return undefined;
  }
  if (!source.collectionId) {
    return undefined;
  }

  const collectionId = source.collectionId;
  const nodeId = source.kind === 'folder' ? source.folderId! : source.request!.id;
  const nodeType = source.kind;

  if (!target || target.kind === 'info' || target.kind === 'hint' || target.kind === 'nav') {
    return undefined;
  }

  if (target.collectionId && target.collectionId !== collectionId) {
    return undefined;
  }

  const col = collections.find((c) => c.id === collectionId);
  if (!col) {
    return undefined;
  }

  if (target.kind === 'collection') {
    return { collectionId, nodeId, nodeType, targetFolderId: null };
  }

  if (target.kind === 'request' && target.request) {
    return {
      collectionId,
      nodeId,
      nodeType,
      targetFolderId: findRequestParentId(col.tree, target.request.id),
      insertBeforeId: target.request.id,
    };
  }

  if (target.kind === 'folder' && target.folderId) {
    if (nodeType === 'folder') {
      if (nodeId === target.folderId) {
        return undefined;
      }
      if (isFolderAncestor(col.tree, nodeId, target.folderId)) {
        return undefined;
      }
    }
    return {
      collectionId,
      nodeId,
      nodeType,
      targetFolderId: target.folderId,
    };
  }

  return undefined;
}

export class CollectionsTreeDragAndDropController
  implements vscode.TreeDragAndDropController<CollectionTreeItem>
{
  readonly dropMimeTypes = [TREE_MIME];
  readonly dragMimeTypes = [TREE_MIME];

  private readonly collectionManager = new CollectionManager(new EnvironmentManager());

  constructor(
    private readonly provider: CollectionsTreeProvider,
    private readonly syncViews: () => Promise<void>
  ) {}

  handleDrag(
    source: readonly CollectionTreeItem[],
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken
  ): void {
    if (source.length !== 1) {
      return;
    }
    const item = source[0];
    if (item.kind !== 'folder' && item.kind !== 'request') {
      return;
    }
    dataTransfer.set(TREE_MIME, new vscode.DataTransferItem(item));
  }

  async handleDrop(
    target: CollectionTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const transferItem = dataTransfer.get(TREE_MIME);
    if (!transferItem) {
      return;
    }

    const source = transferItem.value as CollectionTreeItem;
    if (!source || (source.kind !== 'folder' && source.kind !== 'request')) {
      return;
    }

    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
      return;
    }

    const collections = this.provider.getCollections();
    const move = resolveTreeDropMove(source, target, collections);
    if (!move) {
      return;
    }

    const loaded = this.collectionManager.load(root);
    const { error } = this.collectionManager.moveTreeNode(
      root,
      loaded,
      move.collectionId,
      move.nodeId,
      move.nodeType,
      move.targetFolderId,
      move.insertBeforeId
    );

    if (error) {
      void vscode.window.showErrorMessage(error);
      return;
    }

    await this.syncViews();
  }
}

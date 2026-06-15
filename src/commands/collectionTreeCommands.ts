import * as vscode from 'vscode';
import { CollectionManager } from '../collections/CollectionManager';
import { EnvironmentManager } from '../environment/EnvironmentManager';
import { AUTO_GENERATED_COLLECTION_ID } from '../core/types';
import {
  nextAvailableCollectionName,
  validateCollectionName,
} from '../collections/ScanMerger';
import {
  nextAvailableFolderName,
  validateFolderName,
} from '../storage/treeOperations';
import {
  pickCollectionImportFile,
  readCollectionImportDocument,
  saveCollectionExportFile,
} from '../webview/collectionFiles';
import { CollectionTreeItem, CollectionsTreeProvider } from '../views/CollectionsTreeProvider';
import { ApiScopePanel } from '../webview/ApiScopePanel';

export function registerCollectionTreeCommands(
  context: vscode.ExtensionContext,
  syncViews: () => Promise<void>,
  getProvider: () => CollectionsTreeProvider,
  getTreeView: () => vscode.TreeView<CollectionTreeItem> | undefined
): void {
  const manager = new CollectionManager(new EnvironmentManager());

  const workspaceRoot = (): string | undefined =>
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  const syncPanel = async () => {
    await syncViews();
  };

  const revealRequestInTree = async (collectionId: string, requestId: string): Promise<void> => {
    const treeView = getTreeView();
    if (!treeView) {
      return;
    }
    const reveal = async () => {
      const item = getProvider().getRequestTreeItem(collectionId, requestId);
      if (!item) {
        return false;
      }
      await treeView.reveal(item, { select: true, focus: true, expand: true });
      return true;
    };
    try {
      if (!(await reveal())) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        await reveal();
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
      try {
        await reveal();
      } catch {
        // Tree reveal is best-effort if the view is hidden or the item is missing.
      }
    }
  };

  const openRequest = (requestId: string, preserveFocus = false) => {
    ApiScopePanel.createOrShow(context.extensionUri, context, requestId, preserveFocus);
    ApiScopePanel.currentPanel?.navigateToRequest(requestId);
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('apiScope.refreshCollections', () => syncPanel()),

    vscode.commands.registerCommand('apiScope.newCollection', async () => {
      const root = workspaceRoot();
      if (!root) {
        return;
      }
      const collections = manager.load(root);
      const defaultName = nextAvailableCollectionName(collections.map((c) => c.name));

      const name = await vscode.window.showInputBox({
        title: 'New Collection',
        prompt: 'Collection name (must be unique in this workspace)',
        value: defaultName,
        validateInput: (value) => {
          const trimmed = value.trim();
          if (!trimmed) {
            return 'Collection name cannot be empty.';
          }
          const error = validateCollectionName(trimmed);
          if (error) {
            return error;
          }
          const latest = manager.load(root);
          if (latest.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
            return 'A collection with this name already exists.';
          }
          return undefined;
        },
      });
      if (!name?.trim()) {
        return;
      }

      const { error } = manager.createCollection(root, manager.load(root), name.trim());
      if (error) {
        void vscode.window.showErrorMessage(error);
        return;
      }
      await syncPanel();
    }),

    vscode.commands.registerCommand('apiScope.newFolder', async (item?: CollectionTreeItem) => {
      const root = workspaceRoot();
      if (!root || !item?.collectionId) {
        return;
      }
      const parentFolderId = item.kind === 'folder' ? item.folderId ?? null : null;
      const collections = manager.load(root);
      const col = collections.find((c) => c.id === item.collectionId);
      const tree = col?.tree ?? { root: [], nodes: {} };
      const defaultName = nextAvailableFolderName(tree, parentFolderId);

      const name = await vscode.window.showInputBox({
        title: 'New Folder',
        prompt: 'Folder name (sibling names must be unique in this location)',
        value: defaultName,
        validateInput: (value) => {
          const trimmed = value.trim();
          if (!trimmed) {
            return 'Folder name cannot be empty.';
          }
          const latest = manager.load(root).find((c) => c.id === item.collectionId);
          const latestTree = latest?.tree ?? tree;
          return validateFolderName(latestTree, trimmed, parentFolderId);
        },
      });
      if (!name?.trim()) {
        return;
      }

      const latestCollections = manager.load(root);
      const { error } = manager.createFolder(
        root,
        latestCollections,
        item.collectionId,
        parentFolderId,
        name.trim()
      );
      if (error) {
        void vscode.window.showErrorMessage(error);
        return;
      }
      await syncPanel();
    }),

    vscode.commands.registerCommand('apiScope.newRequest', async (item?: CollectionTreeItem) => {
      const root = workspaceRoot();
      if (!root || !item?.collectionId || item.collectionType === 'generated') {
        return;
      }
      const parentFolderId = item.kind === 'folder' ? item.folderId ?? null : null;

      const name = await vscode.window.showInputBox({
        title: 'New Request',
        prompt: 'Request display name',
        value: 'New Request',
        validateInput: (value) => (!value.trim() ? 'Request name cannot be empty.' : undefined),
      });
      if (!name?.trim()) {
        return;
      }

      const collections = manager.load(root);
      const { error, requestId } = manager.createRequest(
        root,
        collections,
        item.collectionId,
        parentFolderId,
        name.trim()
      );
      if (error) {
        void vscode.window.showErrorMessage(error);
        return;
      }
      await syncPanel();
      if (requestId) {
        await revealRequestInTree(item.collectionId, requestId);
        openRequest(requestId, true);
      }
    }),

    vscode.commands.registerCommand('apiScope.duplicateCollection', async (item?: CollectionTreeItem) => {
      const root = workspaceRoot();
      if (!root || !item?.collectionId) {
        return;
      }
      const collections = manager.load(root);
      const { copy } = manager.duplicateCollection(root, collections, item.collectionId);
      await syncPanel();
      manager.setActiveCollection(root, copy.id);
    }),

    vscode.commands.registerCommand('apiScope.renameCollection', async (item?: CollectionTreeItem) => {
      const root = workspaceRoot();
      if (!root || !item?.collectionId || item.collectionType !== 'user') {
        return;
      }
      const col = manager.load(root).find((c) => c.id === item.collectionId);
      if (!col) {
        return;
      }
      const name = await vscode.window.showInputBox({
        title: 'Rename Collection',
        value: col.name,
        validateInput: (value) => {
          if (!value.trim()) {
            return 'Collection name cannot be empty.';
          }
          return undefined;
        },
      });
      if (!name?.trim()) {
        return;
      }
      const collections = manager.load(root);
      const { error } = manager.renameCollectionWithValidation(
        root,
        collections,
        item.collectionId,
        name.trim()
      );
      if (error) {
        void vscode.window.showErrorMessage(error);
        return;
      }
      await syncPanel();
    }),

    vscode.commands.registerCommand('apiScope.renameFolder', async (item?: CollectionTreeItem) => {
      const root = workspaceRoot();
      if (!root || !item?.collectionId || !item.folderId) {
        return;
      }
      const col = manager.load(root).find((c) => c.id === item.collectionId);
      const node = col?.tree.nodes[item.folderId];
      if (!node) {
        return;
      }
      const name = await vscode.window.showInputBox({
        title: 'Rename Folder',
        value: node.name,
        validateInput: (value) => (!value.trim() ? 'Folder name cannot be empty.' : undefined),
      });
      if (!name?.trim()) {
        return;
      }
      const collections = manager.load(root);
      const { error } = manager.renameFolder(
        root,
        collections,
        item.collectionId,
        item.folderId,
        name.trim()
      );
      if (error) {
        void vscode.window.showErrorMessage(error);
        return;
      }
      await syncPanel();
    }),

    vscode.commands.registerCommand('apiScope.deleteFolder', async (item?: CollectionTreeItem) => {
      const root = workspaceRoot();
      if (!root || !item?.collectionId || !item.folderId) {
        return;
      }
      const collections = manager.load(root);
      const stats = manager.getFolderDeleteStats(collections, item.collectionId, item.folderId);
      if (!stats) {
        return;
      }
      const choice = await vscode.window.showWarningMessage(
        `Delete folder "${stats.folderName}"?\n\n` +
          `${stats.requestCount} request(s) and ${stats.subfolderCount} subfolder(s) will be removed.\n\n` +
          'This action cannot be undone.',
        { modal: true },
        'Delete'
      );
      if (choice !== 'Delete') {
        return;
      }
      const { error } = manager.deleteFolder(root, collections, item.collectionId, item.folderId);
      if (error) {
        void vscode.window.showErrorMessage(error);
        return;
      }
      await syncPanel();
    }),

    vscode.commands.registerCommand('apiScope.renameRequest', async (item?: CollectionTreeItem) => {
      const root = workspaceRoot();
      if (!root || !item?.collectionId || !item.request) {
        return;
      }
      const current = item.request.name?.trim() || item.request.path;
      const name = await vscode.window.showInputBox({
        title: 'Rename Request',
        value: current,
        validateInput: (value) => (!value.trim() ? 'Request name cannot be empty.' : undefined),
      });
      if (!name?.trim()) {
        return;
      }
      const collections = manager.load(root);
      const { error } = manager.renameRequest(
        root,
        collections,
        item.collectionId,
        item.request.id,
        name.trim()
      );
      if (error) {
        void vscode.window.showErrorMessage(error);
        return;
      }
      await syncPanel();
    }),

    vscode.commands.registerCommand('apiScope.duplicateRequest', async (item?: CollectionTreeItem) => {
      const root = workspaceRoot();
      if (!root || !item?.collectionId || !item.request) {
        return;
      }
      const collections = manager.load(root);
      const { copyId } = manager.duplicateRequestInCollection(
        root,
        collections,
        item.collectionId,
        item.request.id
      );
      await syncPanel();
      if (copyId) {
        await revealRequestInTree(item.collectionId, copyId);
        openRequest(copyId, true);
      }
    }),

    vscode.commands.registerCommand('apiScope.deleteCollection', async (item?: CollectionTreeItem) => {
      const root = workspaceRoot();
      if (!root || !item?.collectionId || item.collectionId === AUTO_GENERATED_COLLECTION_ID) {
        return;
      }
      const col = manager.load(root).find((c) => c.id === item.collectionId);
      if (!col) {
        return;
      }
      const choice = await vscode.window.showWarningMessage(
        `Delete collection "${col.name}"? This cannot be undone.`,
        { modal: true },
        'Delete'
      );
      if (choice !== 'Delete') {
        return;
      }
      const collections = manager.load(root);
      manager.deleteCollection(root, collections, item.collectionId);
      await syncPanel();
    }),

    vscode.commands.registerCommand('apiScope.deleteRequest', async (item?: CollectionTreeItem) => {
      const root = workspaceRoot();
      if (!root || !item?.collectionId || !item.request) {
        return;
      }
      const collections = manager.load(root);
      manager.deleteRequest(root, collections, item.collectionId, item.request.id);
      await syncPanel();
    }),

    vscode.commands.registerCommand('apiScope.exportCollection', async (item?: CollectionTreeItem) => {
      const root = workspaceRoot();
      if (!root || !item?.collectionId) {
        return;
      }
      const collections = manager.load(root);
      const document = manager.buildExportDocument(root, collections, item.collectionId);
      if (!document) {
        void vscode.window.showErrorMessage('Collection not found.');
        return;
      }
      try {
        const savedPath = await saveCollectionExportFile(document);
        if (savedPath) {
          void vscode.window.showInformationMessage('Collection exported successfully.');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(msg);
      }
    }),

    vscode.commands.registerCommand('apiScope.importCollection', async () => {
      const root = workspaceRoot();
      if (!root) {
        return;
      }
      try {
        const picked = await pickCollectionImportFile();
        if (!picked) {
          return;
        }
        const document = readCollectionImportDocument(picked.content);
        const collections = manager.load(root);
        const { collection, renamed, finalName } = manager.importFromDocument(
          root,
          collections,
          document
        );
        await syncPanel();
        const notification = renamed
          ? `Collection imported as "${finalName}".`
          : 'Collection imported successfully.';
        void vscode.window.showInformationMessage(notification);
        manager.setActiveCollection(root, collection.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(msg);
      }
    })
  );
}

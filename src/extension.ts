import * as vscode from 'vscode';
import { registerCollectionTreeCommands } from './commands/collectionTreeCommands';
import { registerSidebarCommands } from './commands/sidebarCommands';
import { ApiScopePanel } from './webview/ApiScopePanel';
import { CollectionsTreeDragAndDropController } from './views/CollectionsTreeDragAndDrop';
import { CollectionTreeItem, CollectionsTreeProvider } from './views/CollectionsTreeProvider';
import { CollectionManager } from './collections/CollectionManager';
import { EnvironmentManager } from './environment/EnvironmentManager';
import type { CollectionRequest } from './core/types';
import { detectProjectFramework } from './scanner/detectProjectFramework';
import { performWorkspaceScan } from './scanner/performWorkspaceScan';
import { isScannableSourceFile } from './scanner/scannableSourceExtensions';
import { apiscopeExists, loadConfig } from './storage/ApiScopeStorage';
import { projectDetectedMessage } from './core/projectLabel';
import { openCollectionRequestSource } from './webview/openRequestSource';

let collectionsTree: CollectionsTreeProvider | undefined;
let collectionsTreeView: vscode.TreeView<CollectionTreeItem> | undefined;
let syncCollectionsViews: (() => Promise<void>) | undefined;
let frameworkDetectionShown = false;

export function activate(context: vscode.ExtensionContext) {
  collectionsTree = new CollectionsTreeProvider();

  const refreshTree = () => collectionsTree!.refresh();
  syncCollectionsViews = async () => {
    await refreshTree();
    if (ApiScopePanel.currentPanel) {
      await ApiScopePanel.currentPanel.loadState();
    }
  };

  const dragAndDrop = new CollectionsTreeDragAndDropController(
    collectionsTree,
    () => syncCollectionsViews!()
  );

  context.subscriptions.push(
    (collectionsTreeView = vscode.window.createTreeView('apiScope.collections', {
      treeDataProvider: collectionsTree,
      dragAndDropController: dragAndDrop,
    }))
  );

  context.subscriptions.push(
    collectionsTreeView.onDidChangeVisibility((event) => {
      if (event.visible) {
        void collectionsTree?.refresh({ initialize: true });
      }
    })
  );

  registerSidebarCommands(context);

  registerCollectionTreeCommands(
    context,
    () => syncCollectionsViews!(),
    () => collectionsTree!,
    () => collectionsTreeView
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('apiScope.open', (requestId?: string) => {
      ApiScopePanel.createOrShow(context.extensionUri, context, requestId);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'apiScope.openSource',
      async (arg?: string | CollectionTreeItem) => {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!root) {
          return;
        }

        const request = resolveOpenSourceRequest(root, arg);
        if (!request) {
          void vscode.window.showWarningMessage('No source file available for this request.');
          return;
        }

        const opened = await openCollectionRequestSource(root, request);
        if (!opened) {
          void vscode.window.showWarningMessage('No source file available for this request.');
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('apiScope.scan', async () => {
      if (ApiScopePanel.currentPanel) {
        await ApiScopePanel.currentPanel.scan();
      } else {
        const scanned = await runWorkspaceRescan({ skipDirtyCheck: true });
        if (!scanned) {
          ApiScopePanel.createOrShow(context.extensionUri, context);
        } else {
          await collectionsTree?.refresh();
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('apiScope.rescan', async () => {
      if (ApiScopePanel.currentPanel) {
        await ApiScopePanel.currentPanel.scan();
      } else {
        const scanned = await runWorkspaceRescan();
        if (scanned) {
          await collectionsTree?.refresh();
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('apiScope.loginLikeBrowser', async () => {
      await vscode.commands.executeCommand('apiScope.openLoginTab');
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      frameworkDetectionShown = false;
      void collectionsTree?.refresh();
      void detectAndNotifyFramework(context);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (!isScannableSourceFile(doc.fileName)) {
        return;
      }

      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root || !apiscopeExists(root)) {
        return;
      }

      const config = loadConfig(root);
      if (config.automaticScan === false) {
        return;
      }

      if (ApiScopePanel.currentPanel) {
        void ApiScopePanel.currentPanel.autoRescanFromSourceChange();
        return;
      }

      void runWorkspaceRescan({ skipDirtyCheck: true, quiet: true }).then(async (scanned) => {
        if (scanned) {
          await syncCollectionsViews?.();
        }
      });
    })
  );

  if (vscode.workspace.workspaceFolders?.length) {
    void detectAndNotifyFramework(context);
  }
}

async function runWorkspaceRescan(options?: {
  skipDirtyCheck?: boolean;
  quiet?: boolean;
}): Promise<boolean> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    if (!options?.quiet) {
      void vscode.window.showErrorMessage('No workspace folder open');
    }
    return false;
  }

  const root = folder.uri.fsPath;
  const collectionManager = new CollectionManager(new EnvironmentManager());

  if (!options?.skipDirtyCheck && collectionManager.needsRescanConfirmation(collectionManager.load(root))) {
    const choice = await vscode.window.showWarningMessage(
      'The Generated Collection will be refreshed from source code.\n\nCustom changes may be overwritten.',
      { modal: true },
      'Continue',
      'Cancel'
    );
    if (choice !== 'Continue') {
      return false;
    }
  }

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'APIScope',
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'Scanning API endpoints...' });
      return performWorkspaceScan(root);
    }
  );

  if (!result) {
    if (!options?.quiet) {
      void vscode.window.showErrorMessage(
        'No supported API framework detected. Open a Spring Boot, Node.js / Express, or Python / FastAPI project to scan endpoints.'
      );
    }
    return false;
  }

  if (ApiScopePanel.currentPanel) {
    await ApiScopePanel.currentPanel.loadState();
  }

  return true;
}

async function detectAndNotifyFramework(context: vscode.ExtensionContext) {
  if (frameworkDetectionShown) {
    return;
  }
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return;
  }
  const info = await detectProjectFramework(folder.uri.fsPath);
  if (!info.detected) {
    return;
  }
  frameworkDetectionShown = true;
  const scan = 'Scan Endpoints';
  const choice = await vscode.window.showInformationMessage(
    projectDetectedMessage(info.label),
    scan,
    'Open APIScope'
  );
  if (choice === scan) {
    await vscode.commands.executeCommand('apiScope.scan');
  } else if (choice === 'Open APIScope') {
    await vscode.commands.executeCommand('apiScope.open');
  }
}

function resolveOpenSourceRequest(
  workspaceRoot: string,
  arg?: string | CollectionTreeItem
): CollectionRequest | undefined {
  if (!arg) {
    return undefined;
  }

  if (typeof arg === 'object' && arg.kind === 'request' && arg.request) {
    return arg.request;
  }

  if (typeof arg === 'string') {
    const manager = new CollectionManager(new EnvironmentManager());
    return manager.findRequest(manager.load(workspaceRoot), arg)?.request;
  }

  return undefined;
}

export function deactivate() {
  ApiScopePanel.currentPanel?.dispose();
  collectionsTree = undefined;
  collectionsTreeView = undefined;
}

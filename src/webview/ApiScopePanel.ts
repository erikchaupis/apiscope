import * as vscode from 'vscode';
import { countEndpoints } from '../core/collectionUtils';
import {
  ApiRequest,
  ApiResponse,
  ApiScopeStateJson,
  ApiScopeUiPreferences,
  RequestResponseLayoutMode,
  AUTO_GENERATED_COLLECTION_ID,
  CollectionRequest,
  EnvironmentTier,
  AuthMethodId,
  ScanSummary,
  EnvironmentVariable,
  toJson,
} from '../core/types';
import { AuthManager } from '../authentication/AuthManager';
import { AuthStorage } from '../authentication/AuthStorage';
import { CollectionManager } from '../collections/CollectionManager';
import { EnvironmentManager } from '../environment/EnvironmentManager';
import { extractPostRequestVariables } from '../core/postRequestVariables';
import { buildResolutionScope } from '../core/variableResolution';
import { getRuntimeVariableStore } from '../runtime/RuntimeVariableStore';
import { validateMultipartFiles } from '../core/requestBody';
import { runPostRequestScript, runPreRequestScript, runTestScript } from '../automation/scriptRunner';
import {
  SCRIPT_TEST_CHECK_ID,
  evaluateResponseTests,
} from '../core/responseTests';
import type { ResponseTestResult } from '../core/types';
import { executeRequest } from '../request-executor/RequestExecutor';
import { checkUploadFilePaths, pickUploadFile } from './uploadFiles';
import {
  pickCollectionImportFile,
  readCollectionImportDocument,
  saveCollectionExportFile,
} from './collectionFiles';
import {
  enrichApiResponse,
  enrichHistoryEntryResponse,
  revealDownloadInFolder,
  saveDownloadToUserLocation,
} from './downloadFiles';
import { cleanupEphemeralDownloads } from '../storage/DownloadStorage';
import { getScannerForProject } from '../scanner/ScannerRegistry';
import { detectProjectFramework } from '../scanner/detectProjectFramework';
import { performWorkspaceScan } from '../scanner/performWorkspaceScan';
import {
  apiscopeExists,
  createRequestInStorage,
  loadConfig,
  loadLastScan,
  saveConfig,
  updateRequestFile,
} from '../storage/ApiScopeStorage';
import {
  apiRequestToDraftPatch,
  createDraftFromHistory,
  deleteDraft,
  draftToApiRequest,
  listDrafts,
  loadDraft,
  updateDraft,
} from '../storage/DraftStorage';
import {
  loadHistoryEntry,
  listHistorySummaries,
  recordHistoryEntry,
  getHistoryService,
} from '../storage/HistoryStorage';
import { openCollectionRequestSource } from './openRequestSource';

export class ApiScopePanel {
  public static currentPanel: ApiScopePanel | undefined;
  public static readonly viewType = 'apiScope';

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly context: vscode.ExtensionContext;
  private readonly envManager: EnvironmentManager;
  private readonly authStorage: AuthStorage;
  private readonly authManager: AuthManager;
  private readonly collectionManager: CollectionManager;
  private disposables: vscode.Disposable[] = [];
  private lastState: ApiScopeStateJson | null = null;
  private pendingNavigation: { requestId: string } | undefined;
  private pendingOpenLoginTab = false;
  private pendingOpenEnvironmentTab = false;
  private pendingOpenHistoryTab = false;
  private pendingOpenScanTab = false;
  private webviewReady = false;
  private lastFramework: { id: string; label: string } | null = null;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.context = context;
    this.envManager = new EnvironmentManager();
    this.authStorage = new AuthStorage(context);
    this.authManager = new AuthManager();
    this.collectionManager = new CollectionManager(this.envManager);

    this.panel.webview.html = this.getHtml();
    this.panel.webview.onDidReceiveMessage(this.handleMessage.bind(this), null, this.disposables);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.disposables.push(
      vscode.window.onDidChangeActiveColorTheme(() => this.sendTheme())
    );
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
    selectRequestId?: string,
    preserveFocus = false
  ) {
    const column = vscode.window.activeTextEditor?.viewColumn;

    if (ApiScopePanel.currentPanel) {
      ApiScopePanel.currentPanel.panel.reveal(column, preserveFocus);
      if (selectRequestId) {
        ApiScopePanel.currentPanel.navigateToRequest(selectRequestId);
      }
      return;
    }

    const downloadRoots =
      vscode.workspace.workspaceFolders?.map((folder) =>
        vscode.Uri.joinPath(folder.uri, '.apiscope', 'downloads')
      ) ?? [];

    const panel = vscode.window.createWebviewPanel(
      ApiScopePanel.viewType,
      'APIScope',
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist'),
          ...downloadRoots,
        ],
      }
    );

    ApiScopePanel.currentPanel = new ApiScopePanel(panel, extensionUri, context);
    if (selectRequestId) {
      ApiScopePanel.currentPanel.pendingNavigation = { requestId: selectRequestId };
    }
    void ApiScopePanel.currentPanel.initialize(true);
  }

  public navigateToRequest(requestId: string) {
    this.pendingNavigation = { requestId };
    this.flushPendingNavigation();
  }

  /** @deprecated use navigateToRequest */
  public selectRequest(requestId: string) {
    this.navigateToRequest(requestId);
  }

  private flushPendingNavigation() {
    if (!this.webviewReady || !this.pendingNavigation || !this.lastState) {
      return;
    }

    const { requestId } = this.pendingNavigation;
    const found = this.collectionManager.findRequest(this.lastState.collections, requestId);
    if (!found) {
      return;
    }

    const { collection, request, controllerName } = found;

    this.lastState = {
      ...this.lastState,
      selectedCollectionId: collection.id,
      activeCollectionId: collection.id,
      selectedRequestId: requestId,
    };

    this.postMessage({ type: 'state', data: this.lastState });
    this.postMessage({
      type: 'navigateToRequest',
      requestId,
      collectionId: collection.id,
      controllerName,
    });
    this.postMessage({
      type: 'request',
      data: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        queryParams: request.queryParams,
        body: request.body,
      },
      requestId,
      collectionId: collection.id,
      collectionType: collection.type,
    });

    this.pendingNavigation = undefined;
  }

  public async autoRescanFromSourceChange() {
    const root = this.getWorkspaceRoot();
    if (!root || !apiscopeExists(root)) {
      return;
    }
    const config = loadConfig(root);
    if (config.automaticScan === false) {
      return;
    }
    await this.performRescan();
  }

  public async scan(skipDirtyCheck = false) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this.postMessage({ type: 'error', message: 'No workspace folder open' });
      return;
    }

    if (!skipDirtyCheck) {
      const collections = this.collectionManager.load(workspaceFolder.uri.fsPath);
      if (this.collectionManager.needsRescanConfirmation(collections)) {
        const choice = await vscode.window.showWarningMessage(
          'The Generated Collection will be refreshed from source code.\n\nCustom changes may be overwritten.',
          { modal: true },
          'Continue',
          'Cancel'
        );
        if (choice !== 'Continue') {
          return;
        }
      }
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'APIScope',
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: 'Scanning API endpoints...' });
        await this.performRescan();
      }
    );
  }

  private async initialize(autoScanIfEmpty: boolean) {
    await this.loadState();
    if (!autoScanIfEmpty) {
      return;
    }
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }
    const root = workspaceFolder.uri.fsPath;
    if (!apiscopeExists(root)) {
      return;
    }
    const config = loadConfig(root);
    if (config.automaticScan === false) {
      return;
    }
    const collections = this.collectionManager.load(root);
    const auto = this.collectionManager.getAutoGenerated(collections);
    const scanner = await getScannerForProject(root);
    if (scanner && (!auto || countEndpoints(auto) === 0)) {
      await this.performRescan();
    }
  }

  async loadState() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this.postMessage({ type: 'error', message: 'No workspace folder open' });
      return;
    }

    const root = workspaceFolder.uri.fsPath;
    cleanupEphemeralDownloads(root);
    const config = loadConfig(root);
    const projectInfo = await detectProjectFramework(root);
    const environments = await this.envManager.refreshGeneratedEnvironment(root);
    const activeEnvironmentId = await this.envManager.getActiveEnvironmentId(root);
    const collections = this.collectionManager.load(root);
    const authStatus = await this.authStorage.getStatus();
    const history = listHistorySummaries(root);
    const drafts = listDrafts(root);

    this.lastState = toJson(
      collections,
      environments,
      activeEnvironmentId,
      config.activeCollectionId ?? AUTO_GENERATED_COLLECTION_ID,
      { detected: projectInfo.detected, framework: this.lastFramework?.id, label: projectInfo.label },
      authStatus,
      {
        ...this.stateExtras({ ui: config.ui, layout: config.layout }),
        history,
        drafts,
        lastScan: loadLastScan(root),
        automaticScan: config.automaticScan !== false,
        runtimeVariables: getRuntimeVariableStore().toVariables(),
      }
    );

    this.postMessage({ type: 'state', data: this.lastState });
    this.flushPendingNavigation();
  }

  private async persistLayout(layout: RequestResponseLayoutMode) {
    const root = this.getWorkspaceRoot();
    if (!root) {
      return;
    }
    const config = loadConfig(root);
    saveConfig(root, { ...config, layout });
    if (this.lastState) {
      this.lastState = { ...this.lastState, layout };
    }
  }

  private async persistUiPreferences(patch: ApiScopeUiPreferences) {
    const root = this.getWorkspaceRoot();
    if (!root) {
      return;
    }
    const config = loadConfig(root);
    const ui: ApiScopeUiPreferences = { ...config.ui, ...patch };
    saveConfig(root, { ...config, ui });
    if (this.lastState) {
      this.lastState = { ...this.lastState, ui };
    }
  }

  private async performRescan(): Promise<ScanSummary | null> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return null;
    }

    const root = workspaceFolder.uri.fsPath;
    const result = await performWorkspaceScan(root);
    if (!result) {
      this.postMessage({
        type: 'error',
        message:
          'No supported API framework detected. Open a Spring Boot, Node.js / Express, or Python / FastAPI project to scan endpoints.',
      });
      return null;
    }

    const { collections: updated, summary, frameworkId, frameworkLabel } = result;
    this.lastFramework = { id: frameworkId, label: frameworkLabel };

    const config = loadConfig(root);
    const environments = await this.envManager.getEnvironments(root);
    const activeEnvironmentId = await this.envManager.getActiveEnvironmentId(root);
    const authStatus = await this.authStorage.getStatus();
    const projectInfo = await detectProjectFramework(root);

    this.lastState = toJson(
      updated,
      environments,
      activeEnvironmentId,
      config.activeCollectionId ?? AUTO_GENERATED_COLLECTION_ID,
      { detected: projectInfo.detected, framework: frameworkId, label: projectInfo.label },
      authStatus,
      this.stateExtras({
        framework: frameworkId,
        frameworkLabel,
        ui: config.ui ?? this.lastState?.ui,
        layout: config.layout ?? this.lastState?.layout,
        lastScan: loadLastScan(root),
        automaticScan: config.automaticScan !== false,
      })
    );

    const autoGenerated = updated.find((c) => c.id === AUTO_GENERATED_COLLECTION_ID);
    this.postMessage({ type: 'state', data: this.lastState });
    this.syncCollectionsTreeView();
    this.postMessage({
      type: 'scanSummary',
      data: {
        ...summary,
        endpointCount: autoGenerated ? countEndpoints(autoGenerated) : 0,
      },
    });
    this.flushPendingNavigation();
    return summary;
  }

  public openLoginTab() {
    if (this.webviewReady) {
      this.postMessage({ type: 'openLoginTab' });
      return;
    }
    this.pendingOpenLoginTab = true;
  }

  public openEnvironmentTab() {
    if (this.webviewReady) {
      this.postMessage({ type: 'openEnvironmentTab' });
      return;
    }
    this.pendingOpenEnvironmentTab = true;
  }

  public openHistoryTab() {
    if (this.webviewReady) {
      this.postMessage({ type: 'openHistoryTab' });
      return;
    }
    this.pendingOpenHistoryTab = true;
  }

  public openScanTab() {
    if (this.webviewReady) {
      this.postMessage({ type: 'openScanTab' });
      return;
    }
    this.pendingOpenScanTab = true;
  }

  /** @deprecated Use openLoginTab */
  public openSessionLoginModal() {
    this.openLoginTab();
  }

  private flushPendingTabs() {
    if (!this.webviewReady) {
      return;
    }
    if (this.pendingOpenLoginTab) {
      this.pendingOpenLoginTab = false;
      this.postMessage({ type: 'openLoginTab' });
    }
    if (this.pendingOpenEnvironmentTab) {
      this.pendingOpenEnvironmentTab = false;
      this.postMessage({ type: 'openEnvironmentTab' });
    }
    if (this.pendingOpenHistoryTab) {
      this.pendingOpenHistoryTab = false;
      this.postMessage({ type: 'openHistoryTab' });
    }
    if (this.pendingOpenScanTab) {
      this.pendingOpenScanTab = false;
      this.postMessage({ type: 'openScanTab' });
    }
  }

  private getWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  private syncCollectionsTreeView(): void {
    void vscode.commands.executeCommand('apiScope.refreshCollections');
  }

  private async handleMessage(message: { type: string; [key: string]: unknown }) {
    const root = this.getWorkspaceRoot();

    switch (message.type) {
      case 'ready':
      case 'webviewReady':
        this.webviewReady = true;
        this.sendTheme();
        if (this.lastState) {
          this.postMessage({ type: 'state', data: this.lastState });
        } else {
          await this.initialize(true);
        }
        this.flushPendingNavigation();
        this.flushPendingTabs();
        break;
      case 'rescan': {
        if (!root) {
          break;
        }
        const collections = this.collectionManager.load(root);
        if (this.collectionManager.needsRescanConfirmation(collections)) {
          this.postMessage({ type: 'confirmRescan' });
        } else {
          await this.performRescan();
        }
        break;
      }
      case 'rescanConfirmed':
        await this.performRescan();
        break;
      case 'setAutomaticScan':
        if (root && typeof message.enabled === 'boolean') {
          const config = loadConfig(root);
          saveConfig(root, { ...config, automaticScan: message.enabled });
          if (this.lastState) {
            this.lastState = { ...this.lastState, automaticScan: message.enabled };
            this.postMessage({ type: 'state', data: this.lastState });
          }
        }
        break;
      case 'performAuthLogin':
      case 'performSessionLogin': {
        const method = (typeof message.method === 'string'
          ? message.method
          : 'session') as AuthMethodId;
        const environmentId =
          typeof message.environmentId === 'string'
            ? message.environmentId
            : this.lastState?.activeEnvironmentId;
        let payload: unknown = message.payload;
        if (method === 'session' && !payload) {
          payload = {
            loginUrl: message.loginUrl ?? (message.payload as { loginUrl?: string })?.loginUrl,
            username: message.username ?? (message.payload as { username?: string })?.username,
            password: message.password ?? (message.payload as { password?: string })?.password,
          };
        }
        if (root && environmentId && payload) {
          const result = await this.authManager.login(
            method,
            this.authStorage,
            this.envManager,
            root,
            environmentId,
            payload
          );
          if (result.success) {
            await this.loadState();
          }
          this.postMessage({
            type: 'authLoginResult',
            success: result.success,
            error: result.error,
            cookieNames: result.cookieNames,
          });
        }
        break;
      }
      case 'performAuthLogout':
      case 'logout': {
        const logoutRoot = this.getWorkspaceRoot();
        if (logoutRoot) {
          const method =
            typeof message.method === 'string' ? (message.method as AuthMethodId) : undefined;
          await this.authManager.logout(method, this.authStorage, this.envManager, logoutRoot);
          await this.loadState();
        }
        break;
      }
      case 'setActiveEnvironment':
        if (typeof message.environmentId === 'string' && root) {
          await this.envManager.setActiveEnvironmentId(root, message.environmentId);
          if (this.lastState) {
            this.lastState = {
              ...this.lastState,
              activeEnvironmentId: message.environmentId,
            };
            this.postMessage({ type: 'state', data: this.lastState });
          }
          await this.loadState();
        }
        break;
      case 'updateEnvironmentVariable':
        if (
          root &&
          typeof message.environmentId === 'string' &&
          typeof message.name === 'string' &&
          typeof message.value === 'string'
        ) {
          const envs = await this.envManager.updateEnvironmentVariable(
            root,
            message.environmentId,
            message.name,
            message.value
          );
          if (this.lastState) {
            this.lastState = { ...this.lastState, environments: envs };
            this.postMessage({ type: 'state', data: this.lastState });
          }
        }
        break;
      case 'createEnvironment':
        if (root && typeof message.name === 'string') {
          try {
            const environmentType =
              typeof message.environmentType === 'string'
                ? (message.environmentType as EnvironmentTier)
                : undefined;
            await this.envManager.createEnvironment(
              root,
              message.name,
              environmentType
            );
            await this.loadState();
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.postMessage({ type: 'error', message: msg });
          }
        }
        break;
      case 'setEnvironmentType':
        if (
          root &&
          typeof message.environmentId === 'string' &&
          typeof message.environmentType === 'string'
        ) {
          try {
            await this.envManager.setEnvironmentType(
              root,
              message.environmentId,
              message.environmentType as EnvironmentTier
            );
            await this.loadState();
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.postMessage({ type: 'error', message: msg });
          }
        }
        break;
      case 'renameEnvironment':
        if (root && typeof message.environmentId === 'string' && typeof message.name === 'string') {
          try {
            await this.envManager.renameEnvironment(root, message.environmentId, message.name);
            await this.loadState();
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.postMessage({ type: 'error', message: msg });
          }
        }
        break;
      case 'deleteEnvironment':
        if (root && typeof message.environmentId === 'string') {
          try {
            await this.envManager.deleteEnvironment(root, message.environmentId);
            await this.loadState();
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.postMessage({ type: 'error', message: msg });
          }
        }
        break;
      case 'setEnvironmentVariables':
        if (
          root &&
          typeof message.environmentId === 'string' &&
          Array.isArray(message.variables)
        ) {
          const envs = await this.envManager.setEnvironmentVariables(
            root,
            message.environmentId,
            message.variables as import('../core/types').EnvironmentVariable[]
          );
          if (this.lastState) {
            this.lastState = { ...this.lastState, environments: envs };
            this.postMessage({ type: 'state', data: this.lastState });
          }
        }
        break;
      case 'copyEnvironmentVariable':
        if (
          root &&
          typeof message.sourceEnvironmentId === 'string' &&
          message.variable &&
          Array.isArray(message.targetEnvironmentIds)
        ) {
          try {
            const { environments, copiedCount } =
              await this.envManager.copyVariableToEnvironments(
                root,
                message.sourceEnvironmentId,
                message.variable as import('../core/types').EnvironmentVariable,
                message.targetEnvironmentIds as string[],
                message.overwriteExisting !== false
              );
            if (this.lastState) {
              this.lastState = { ...this.lastState, environments };
              this.postMessage({ type: 'state', data: this.lastState });
            }
            this.postMessage({ type: 'variableCopied', copiedCount });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.postMessage({ type: 'error', message: msg });
          }
        }
        break;
      case 'clearRuntimeVariables': {
        getRuntimeVariableStore().clear();
        this.syncRuntimeVariables();
        break;
      }
      case 'deleteRuntimeVariable':
        if (typeof message.name === 'string') {
          getRuntimeVariableStore().unset(message.name);
          this.syncRuntimeVariables();
        }
        break;
      case 'promoteRuntimeVariable':
        if (root && typeof message.name === 'string') {
          const runtimeStore = getRuntimeVariableStore();
          const value = runtimeStore.get(message.name);
          if (value === undefined) {
            break;
          }
          const targetEnvironmentId =
            typeof message.environmentId === 'string'
              ? message.environmentId
              : await this.envManager.getActiveEnvironmentId(root);
          const envs = await this.envManager.getEnvironments(root);
          const target = envs.find((e) => e.id === targetEnvironmentId);
          if (!target) {
            break;
          }
          const nextVariables = [...target.variables];
          const existingIndex = nextVariables.findIndex((v) => v.name === message.name);
          if (existingIndex >= 0) {
            nextVariables[existingIndex] = { ...nextVariables[existingIndex], value };
          } else {
            nextVariables.push({ name: message.name, value });
          }
          const updated = await this.envManager.setEnvironmentVariables(
            root,
            targetEnvironmentId,
            nextVariables
          );
          runtimeStore.unset(message.name);
          if (this.lastState) {
            this.lastState = {
              ...this.lastState,
              environments: updated,
              runtimeVariables: runtimeStore.toVariables(),
            };
            this.postMessage({ type: 'state', data: this.lastState });
          }
        }
        break;
      case 'duplicateEnvironment':
        if (root && typeof message.environmentId === 'string') {
          try {
            const { environments, copy } = await this.envManager.duplicateEnvironment(
              root,
              message.environmentId
            );
            await this.envManager.setActiveEnvironmentId(root, copy.id);
            if (this.lastState) {
              this.lastState = {
                ...this.lastState,
                environments,
                activeEnvironmentId: copy.id,
              };
              this.postMessage({ type: 'state', data: this.lastState });
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.postMessage({ type: 'error', message: msg });
          }
        }
        break;
      case 'selectCollection':
        if (typeof message.collectionId === 'string' && root) {
          this.collectionManager.setActiveCollection(root, message.collectionId);
          if (this.lastState) {
            this.lastState = {
              ...this.lastState,
              activeCollectionId: message.collectionId,
              selectedCollectionId: message.collectionId,
            };
            this.postMessage({ type: 'state', data: this.lastState });
          }
        }
        break;
      case 'createCollection':
        if (root) {
          const collections = this.collectionManager.load(root);
          const name = typeof message.name === 'string' ? message.name : undefined;
          const { collections: updated, collection, error } = this.collectionManager.createCollection(
            root,
            collections,
            name
          );
          if (error) {
            this.postMessage({ type: 'error', message: error });
          } else if (this.lastState && collection) {
            this.lastState = {
              ...this.lastState,
              collections: updated,
              activeCollectionId: collection.id,
              selectedCollectionId: collection.id,
            };
            this.postMessage({ type: 'state', data: this.lastState });
            this.syncCollectionsTreeView();
          }
        }
        break;
      case 'duplicateCollection':
        if (typeof message.collectionId === 'string' && root) {
          const collections = this.collectionManager.load(root);
          const { collections: updated, copy } = this.collectionManager.duplicateCollection(
            root,
            collections,
            message.collectionId
          );
          this.collectionManager.setActiveCollection(root, copy.id);
          const environments = await this.envManager.getEnvironments(root);
          const activeEnvironmentId = await this.envManager.getActiveEnvironmentId(root);
          const authStatus = await this.authStorage.getStatus();
          if (this.lastState) {
            this.lastState = {
              ...this.lastState,
              collections: updated,
              environments,
              activeEnvironmentId,
              authStatus,
              activeCollectionId: copy.id,
              selectedCollectionId: copy.id,
            };
            this.postMessage({ type: 'state', data: this.lastState });
            this.syncCollectionsTreeView();
          }
        }
        break;
      case 'exportCollection':
        if (typeof message.collectionId === 'string' && root) {
          const collections = this.collectionManager.load(root);
          const document = this.collectionManager.buildExportDocument(
            root,
            collections,
            message.collectionId
          );
          if (!document) {
            this.postMessage({ type: 'error', message: 'Collection not found.' });
            break;
          }
          try {
            const savedPath = await saveCollectionExportFile(document);
            if (savedPath) {
              const notification = 'Collection exported successfully.';
              void vscode.window.showInformationMessage(notification);
              this.postMessage({ type: 'notification', message: notification });
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.postMessage({ type: 'error', message: msg });
            void vscode.window.showErrorMessage(msg);
          }
        }
        break;
      case 'importCollection':
        if (root) {
          try {
            const picked = await pickCollectionImportFile();
            if (!picked) {
              break;
            }
            const document = readCollectionImportDocument(picked.content);
            const collections = this.collectionManager.load(root);
            const { collections: updated, collection, renamed, finalName } =
              this.collectionManager.importFromDocument(root, collections, document);
            const environments = await this.envManager.getEnvironments(root);
            const activeEnvironmentId = await this.envManager.getActiveEnvironmentId(root);
            const authStatus = await this.authStorage.getStatus();
            if (this.lastState) {
              this.lastState = {
                ...this.lastState,
                collections: updated,
                environments,
                activeEnvironmentId,
                authStatus,
                activeCollectionId: collection.id,
                selectedCollectionId: collection.id,
              };
              this.postMessage({ type: 'state', data: this.lastState });
              this.syncCollectionsTreeView();
            }
            const notification = renamed
              ? `Collection imported as "${finalName}".`
              : 'Collection imported successfully.';
            void vscode.window.showInformationMessage(notification);
            this.postMessage({ type: 'notification', message: notification });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.postMessage({ type: 'error', message: msg });
            void vscode.window.showErrorMessage(msg);
          }
        }
        break;
      case 'deleteCollection':
        if (typeof message.collectionId === 'string' && root) {
          const collections = this.collectionManager.load(root);
          const updated = this.collectionManager.deleteCollection(
            root,
            collections,
            message.collectionId
          );
          const config = loadConfig(root);
          if (this.lastState) {
            this.lastState = {
              ...this.lastState,
              collections: updated,
              activeCollectionId: config.activeCollectionId,
              selectedCollectionId: config.activeCollectionId,
            };
            this.postMessage({ type: 'state', data: this.lastState });
            this.syncCollectionsTreeView();
          }
        }
        break;
      case 'renameCollection':
        if (
          root &&
          typeof message.collectionId === 'string' &&
          typeof message.name === 'string'
        ) {
          const collections = this.collectionManager.load(root);
          const { collections: updated, error } =
            this.collectionManager.renameCollectionWithValidation(
            root,
            collections,
            message.collectionId,
            message.name
          );
          if (error) {
            this.postMessage({ type: 'error', message: error });
          } else if (this.lastState) {
            this.lastState = { ...this.lastState, collections: updated };
            this.postMessage({ type: 'state', data: this.lastState });
            this.syncCollectionsTreeView();
          }
        }
        break;
      case 'updateRequest':
        if (
          root &&
          typeof message.collectionId === 'string' &&
          typeof message.requestId === 'string' &&
          message.patch
        ) {
          const collections = this.collectionManager.load(root);
          const updated = this.collectionManager.updateRequest(
            root,
            collections,
            message.collectionId,
            message.requestId,
            message.patch as Partial<CollectionRequest>
          );
          if (this.lastState) {
            this.lastState = { ...this.lastState, collections: updated };
            this.postMessage({ type: 'state', data: this.lastState });
          }
        }
        break;
      case 'deleteRequest':
        if (
          root &&
          typeof message.collectionId === 'string' &&
          typeof message.requestId === 'string'
        ) {
          const collections = this.collectionManager.load(root);
          const updated = this.collectionManager.deleteRequest(
            root,
            collections,
            message.collectionId,
            message.requestId
          );
          if (this.lastState) {
            this.lastState = { ...this.lastState, collections: updated };
            this.postMessage({ type: 'state', data: this.lastState });
            this.syncCollectionsTreeView();
          }
        }
        break;
      case 'duplicateRequest':
        if (
          root &&
          typeof message.collectionId === 'string' &&
          typeof message.requestId === 'string'
        ) {
          const collections = this.collectionManager.load(root);
          const { collections: updated, copyId } =
            this.collectionManager.duplicateRequestInCollection(
              root,
              collections,
              message.collectionId,
              message.requestId
            );
          if (this.lastState) {
            this.lastState = { ...this.lastState, collections: updated };
            this.postMessage({ type: 'state', data: this.lastState });
            if (copyId) {
              this.navigateToRequest(copyId);
            }
            this.syncCollectionsTreeView();
          }
        }
        break;
      case 'createFolder':
        if (
          root &&
          typeof message.collectionId === 'string' &&
          typeof message.name === 'string'
        ) {
          const collections = this.collectionManager.load(root);
          const parentFolderId =
            typeof message.parentFolderId === 'string' ? message.parentFolderId : null;
          const { collections: updated, error } = this.collectionManager.createFolder(
            root,
            collections,
            message.collectionId,
            parentFolderId,
            message.name
          );
          if (error) {
            this.postMessage({ type: 'error', message: error });
          } else if (this.lastState) {
            this.lastState = { ...this.lastState, collections: updated };
            this.postMessage({ type: 'state', data: this.lastState });
            this.syncCollectionsTreeView();
          }
        }
        break;
      case 'renameFolder':
        if (
          root &&
          typeof message.collectionId === 'string' &&
          typeof message.folderId === 'string' &&
          typeof message.name === 'string'
        ) {
          const collections = this.collectionManager.load(root);
          const { collections: updated, error } = this.collectionManager.renameFolder(
            root,
            collections,
            message.collectionId,
            message.folderId,
            message.name
          );
          if (error) {
            this.postMessage({ type: 'error', message: error });
          } else if (this.lastState) {
            this.lastState = { ...this.lastState, collections: updated };
            this.postMessage({ type: 'state', data: this.lastState });
            this.syncCollectionsTreeView();
          }
        }
        break;
      case 'deleteFolder':
        if (
          root &&
          typeof message.collectionId === 'string' &&
          typeof message.folderId === 'string'
        ) {
          const collections = this.collectionManager.load(root);
          const { collections: updated, error } = this.collectionManager.deleteFolder(
            root,
            collections,
            message.collectionId,
            message.folderId
          );
          if (error) {
            this.postMessage({ type: 'error', message: error });
          } else if (this.lastState) {
            this.lastState = { ...this.lastState, collections: updated };
            this.postMessage({ type: 'state', data: this.lastState });
            this.syncCollectionsTreeView();
          }
        }
        break;
      case 'createRequest':
        if (root && typeof message.collectionId === 'string') {
          const parentFolderId =
            typeof message.parentFolderId === 'string' ? message.parentFolderId : null;
          const name = typeof message.name === 'string' ? message.name : undefined;
          const collections = this.collectionManager.load(root);
          const { collections: updated, error, requestId } = this.collectionManager.createRequest(
            root,
            collections,
            message.collectionId,
            parentFolderId,
            name
          );
          if (error) {
            this.postMessage({ type: 'error', message: error });
          } else if (this.lastState) {
            this.lastState = { ...this.lastState, collections: updated };
            this.postMessage({ type: 'state', data: this.lastState });
            if (requestId) {
              this.navigateToRequest(requestId);
            }
            this.syncCollectionsTreeView();
          }
        }
        break;
      case 'moveTreeNode':
        if (
          root &&
          typeof message.collectionId === 'string' &&
          typeof message.nodeId === 'string' &&
          (message.nodeType === 'folder' || message.nodeType === 'request')
        ) {
          const collections = this.collectionManager.load(root);
          const targetFolderId =
            typeof message.targetFolderId === 'string' ? message.targetFolderId : null;
          const insertBeforeId =
            typeof message.insertBeforeId === 'string' ? message.insertBeforeId : undefined;
          const { collections: updated, error } = this.collectionManager.moveTreeNode(
            root,
            collections,
            message.collectionId,
            message.nodeId,
            message.nodeType,
            targetFolderId,
            insertBeforeId
          );
          if (error) {
            this.postMessage({ type: 'error', message: error });
          } else if (this.lastState) {
            this.lastState = { ...this.lastState, collections: updated };
            this.postMessage({ type: 'state', data: this.lastState });
            this.syncCollectionsTreeView();
          }
        }
        break;
      case 'renameRequest':
        if (
          root &&
          typeof message.collectionId === 'string' &&
          typeof message.requestId === 'string' &&
          typeof message.name === 'string'
        ) {
          const collections = this.collectionManager.load(root);
          const { collections: updated, error } = this.collectionManager.renameRequest(
            root,
            collections,
            message.collectionId,
            message.requestId,
            message.name
          );
          if (error) {
            this.postMessage({ type: 'error', message: error });
          } else if (this.lastState) {
            this.lastState = { ...this.lastState, collections: updated };
            this.postMessage({ type: 'state', data: this.lastState });
            this.syncCollectionsTreeView();
          }
        }
        break;
      case 'pickUploadFile': {
        const picked = await pickUploadFile();
        if (picked) {
          this.postMessage({ type: 'uploadFilePicked', ...picked });
        }
        break;
      }
      case 'checkUploadFilePaths': {
        const paths = Array.isArray(message.paths)
          ? message.paths.filter((value): value is string => typeof value === 'string')
          : [];
        this.postMessage({
          type: 'uploadFilePathStatus',
          results: checkUploadFilePaths(paths),
        });
        break;
      }
      case 'saveDownloadFile': {
        if (
          root &&
          typeof message.downloadPath === 'string' &&
          typeof message.fileName === 'string'
        ) {
          try {
            await saveDownloadToUserLocation(root, message.downloadPath, message.fileName);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.postMessage({ type: 'error', message: msg });
          }
        }
        break;
      }
      case 'revealDownloadFile': {
        if (root && typeof message.downloadPath === 'string') {
          try {
            await revealDownloadInFolder(root, message.downloadPath);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.postMessage({ type: 'error', message: msg });
          }
        }
        break;
      }
      case 'executeRequest': {
        const auth = await this.authStorage.load();
        const req = message.request as ApiRequest;
        const lastResponse = message.lastResponse as ApiResponse | null | undefined;
        if (!root) {
          break;
        }
        const context = message.context as
          | {
              kind?: 'collection' | 'draft' | 'adhoc';
              collectionId?: string;
              requestId?: string;
              draftId?: string;
              captureResponse?: boolean;
              path?: string;
            }
          | undefined;
        try {
          const envs = await this.envManager.getEnvironments(root);
          const activeId = await this.envManager.getActiveEnvironmentId(root);
          const env = envs.find((e) => e.id === activeId) ?? envs[0];
          const environmentVariables = env?.variables ?? [];
          const requestVariables = this.envManager.buildRequestExecutionScope(req, lastResponse);
          const runtimeStore = getRuntimeVariableStore();
          runtimeStore.setMany(requestVariables);

          const preScript = req.automation?.preRequest?.trim() ?? '';
          let scriptConsoleLogs: string[] = [];
          if (preScript) {
            const preResult = runPreRequestScript(
              preScript,
              requestVariables,
              environmentVariables,
              runtimeStore,
              req
            );
            scriptConsoleLogs = preResult.consoleLogs;
            if (!preResult.success) {
              this.syncRuntimeVariables();
              this.postMessage({
                type: 'error',
                message: preResult.error ?? 'Pre-request script failed.',
                runtimeVariables: preResult.variables,
                scriptConsoleLogs,
              });
              break;
            }
          }

          const resolutionScope = buildResolutionScope(
            environmentVariables,
            runtimeStore.toVariables(),
            requestVariables
          );

          if (env) {
            const missing = this.envManager.findMissingVariables(req, resolutionScope);
            if (missing.length > 0) {
              this.syncRuntimeVariables();
              this.postMessage({
                type: 'error',
                message: `Missing variable: ${missing.join(', ')}`,
              });
              break;
            }
          }

          const resolved = env ? this.envManager.resolveRequest(req, resolutionScope) : req;
          const multipartError = validateMultipartFiles(resolved);
          if (multipartError) {
            this.postMessage({ type: 'error', message: multipartError });
            break;
          }
          const captureResponse = this.resolveCaptureResponse(root, context);
          const started = Date.now();
          let response;
          let execError: string | undefined;
          try {
            response = await executeRequest(resolved, auth, {
              workspaceRoot: root,
              requestUrl: resolved.url,
              persistDownloads: captureResponse,
            });
          } catch (err) {
            execError = err instanceof Error ? err.message : String(err);
            this.syncRuntimeVariables();
            this.postMessage({
              type: 'error',
              message: `Request failed: ${execError}`,
              runtimeVariables: runtimeStore.toVariables(),
              scriptConsoleLogs,
            });
            break;
          }

          if (response) {
            runtimeStore.setMany(
              extractPostRequestVariables(req.automation?.postRequestVariables, response)
            );
          }

          const postScript = req.automation?.postRequest?.trim() ?? '';
          let scriptError: string | undefined;
          if (postScript && response) {
            const postResult = runPostRequestScript(
              postScript,
              requestVariables,
              environmentVariables,
              runtimeStore,
              response
            );
            scriptConsoleLogs = [...scriptConsoleLogs, ...postResult.consoleLogs];
            if (!postResult.success) {
              scriptError = postResult.error ?? 'Post-request script failed.';
            }
          }

          const testScript = req.automation?.tests?.trim() ?? '';
          const testResults: ResponseTestResult[] = evaluateResponseTests(
            req.automation?.responseTests,
            response
          );
          if (testScript && response) {
            const testRun = runTestScript(
              testScript,
              requestVariables,
              environmentVariables,
              runtimeStore,
              response
            );
            if (testRun.success) {
              testResults.push({
                checkId: SCRIPT_TEST_CHECK_ID,
                name: 'Script Test',
                passed: true,
              });
            } else if (testRun.assertionFailure) {
              testResults.push({
                checkId: SCRIPT_TEST_CHECK_ID,
                name: 'Script Test',
                passed: false,
                expected: testRun.assertionFailure.conditionFailed
                  ? undefined
                  : testRun.assertionFailure.expected,
                actual: testRun.assertionFailure.conditionFailed
                  ? undefined
                  : testRun.assertionFailure.actual,
                conditionFailed: testRun.assertionFailure.conditionFailed,
              });
            } else {
              testResults.push({
                checkId: SCRIPT_TEST_CHECK_ID,
                name: 'Script Test',
                passed: false,
                actual: testRun.error,
              });
            }
            scriptConsoleLogs = [...scriptConsoleLogs, ...testRun.consoleLogs];
          }

          this.syncRuntimeVariables();
          this.postMessage({
            type: 'response',
            data: enrichApiResponse(root, this.panel.webview, response),
            runtimeVariables: runtimeStore.toVariables(),
            scriptError,
            scriptConsoleLogs,
            testResults,
          });

          const sourceKind = context?.kind ?? 'adhoc';
          const entry = recordHistoryEntry(root, {
            environmentId: activeId,
            source: {
              kind: sourceKind,
              collectionId: context?.collectionId,
              requestId: context?.requestId,
              draftId: context?.draftId,
            },
            request: req,
            resolvedUrl: resolved.url,
            response,
            captureResponse,
            durationMs: response?.durationMs ?? Date.now() - started,
            error: execError ?? scriptError,
            path: context?.path,
          });

          if (this.lastState) {
            this.lastState = {
              ...this.lastState,
              history: listHistorySummaries(root),
            };
            this.postMessage({ type: 'state', data: this.lastState });
          }
          this.postMessage({ type: 'historyRecorded', entryId: entry.id });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.postMessage({ type: 'error', message: `Request failed: ${msg}` });
        }
        break;
      }
      case 'buildRequestForEndpoint': {
        const requestId = message.requestId as string;
        if (!this.lastState) {
          break;
        }
        const found = this.collectionManager.findRequest(this.lastState.collections, requestId);
        if (!found) {
          break;
        }
        const { collection, request } = found;
        this.lastState = {
          ...this.lastState,
          selectedCollectionId: collection.id,
          activeCollectionId: collection.id,
          selectedRequestId: requestId,
        };
        this.postMessage({
          type: 'request',
          data: {
            method: request.method,
            url: request.url,
            headers: request.headers,
            queryParams: request.queryParams,
            body: request.body,
            requestBody: request.requestBody,
            authorization: request.authorization,
            automation: request.automation,
            ui: request.ui,
          },
          requestId,
          collectionId: collection.id,
          collectionType: collection.type,
        });
        break;
      }
      case 'openSource': {
        if (!root) {
          break;
        }
        const requestId = message.requestId as string;
        const found = this.lastState
          ? this.collectionManager.findRequest(this.lastState.collections, requestId)
          : undefined;
        if (!found || !(await openCollectionRequestSource(root, found.request))) {
          this.postMessage({
            type: 'error',
            message: 'No source file available for this request.',
          });
        }
        break;
      }
      case 'updateUiPreferences':
        if (message.ui && typeof message.ui === 'object') {
          await this.persistUiPreferences(message.ui as ApiScopeUiPreferences);
        }
        break;
      case 'updateLayout':
        if (message.layout === 'horizontal' || message.layout === 'vertical') {
          await this.persistLayout(message.layout);
        }
        break;
      case 'clearAuth':
        await this.authStorage.clear();
        await this.loadState();
        break;
      case 'loadHistoryEntry': {
        if (root && typeof message.historyId === 'string') {
          const entry = loadHistoryEntry(root, message.historyId);
          if (entry) {
            this.postMessage({
              type: 'historyEntry',
              data: enrichHistoryEntryResponse(root, this.panel.webview, entry),
            });
          }
        }
        break;
      }
      case 'loadMoreHistoryDays': {
        if (root) {
          const count =
            typeof message.count === 'number' && message.count > 0 ? message.count : 5;
          const service = getHistoryService(root);
          const history = service.loadNextDays(count);
          if (this.lastState) {
            this.lastState = { ...this.lastState, history };
            this.postMessage({ type: 'state', data: this.lastState });
          }
          this.postMessage({ type: 'historyDaysLoaded', hasMore: service.hasMoreDays() });
        }
        break;
      }
      case 'createDraftFromHistory': {
        if (root && typeof message.historyId === 'string') {
          const history = loadHistoryEntry(root, message.historyId);
          if (!history) {
            break;
          }
          const draft = createDraftFromHistory(root, history);
          if (this.lastState) {
            this.lastState = { ...this.lastState, drafts: listDrafts(root) };
            this.postMessage({ type: 'state', data: this.lastState });
          }
          this.postMessage({ type: 'draft', data: draft });
        }
        break;
      }
      case 'loadDraft': {
        if (root && typeof message.draftId === 'string') {
          const draft = loadDraft(root, message.draftId);
          if (draft) {
            this.postMessage({ type: 'draft', data: draft });
          }
        }
        break;
      }
      case 'updateDraft': {
        if (root && typeof message.draftId === 'string' && message.patch) {
          const updated = updateDraft(
            root,
            message.draftId,
            apiRequestToDraftPatch(message.patch as ApiRequest, message.name as string | undefined)
          );
          if (updated && this.lastState) {
            this.lastState = { ...this.lastState, drafts: listDrafts(root) };
            this.postMessage({ type: 'state', data: this.lastState });
            this.postMessage({ type: 'draft', data: updated });
          }
        }
        break;
      }
      case 'deleteDraft': {
        if (root && typeof message.draftId === 'string') {
          deleteDraft(root, message.draftId);
          if (this.lastState) {
            this.lastState = { ...this.lastState, drafts: listDrafts(root) };
            this.postMessage({ type: 'state', data: this.lastState });
          }
          this.postMessage({ type: 'draftDeleted', draftId: message.draftId });
        }
        break;
      }
      case 'saveDraftToCollection': {
        if (
          root &&
          typeof message.draftId === 'string' &&
          typeof message.collectionId === 'string'
        ) {
          const draft = loadDraft(root, message.draftId);
          if (!draft) {
            break;
          }
          const parentFolderId =
            typeof message.parentFolderId === 'string' ? message.parentFolderId : null;
          const created = createRequestInStorage(root, message.collectionId, parentFolderId);
          if (created.error || !created.requestId) {
            this.postMessage({ type: 'error', message: created.error ?? 'Failed to save draft.' });
            break;
          }
          const saved = updateRequestFile(root, message.collectionId, created.requestId, {
            name: draft.name,
            method: draft.method,
            url: draft.url,
            path: draft.path,
            headers: draft.headers,
            queryParams: draft.queryParams,
            body: draft.body,
            authorization: draft.authorization,
            automation: draft.automation,
            ui: draft.ui,
          });
          if (!saved) {
            this.postMessage({ type: 'error', message: 'Failed to save draft to collection.' });
            break;
          }
          const collections = this.collectionManager.load(root);
          if (this.lastState) {
            this.lastState = {
              ...this.lastState,
              collections,
              selectedCollectionId: message.collectionId,
              selectedRequestId: created.requestId,
            };
            this.postMessage({ type: 'state', data: this.lastState });
            this.syncCollectionsTreeView();
          }
          this.postMessage({
            type: 'request',
            data: draftToApiRequest(draft),
            requestId: created.requestId,
            collectionId: message.collectionId,
            collectionType: 'user',
          });
          this.postMessage({
            type: 'draftSavedToCollection',
            draftId: message.draftId,
            collectionId: message.collectionId,
            requestId: created.requestId,
          });
        }
        break;
      }
      case 'setCaptureResponse': {
        if (
          root &&
          typeof message.collectionId === 'string' &&
          typeof message.requestId === 'string' &&
          typeof message.captureResponse === 'boolean'
        ) {
          const collections = this.collectionManager.load(root);
          const updated = this.collectionManager.updateRequest(
            root,
            collections,
            message.collectionId,
            message.requestId,
            { captureResponse: message.captureResponse }
          );
          if (this.lastState) {
            this.lastState = { ...this.lastState, collections: updated };
            this.postMessage({ type: 'state', data: this.lastState });
          }
        }
        break;
      }
    }
  }

  public async openSourceForRequest(requestId: string) {
    const root = this.getWorkspaceRoot();
    if (!root) {
      return;
    }
    const collections = this.collectionManager.load(root);
    const found = this.collectionManager.findRequest(collections, requestId);
    if (!found || !(await openCollectionRequestSource(root, found.request))) {
      vscode.window.showWarningMessage('No source file available for this request.');
    }
  }

  private stateExtras(
    overrides: {
      framework?: string;
      frameworkLabel?: string;
      ui?: ApiScopeUiPreferences;
      layout?: RequestResponseLayoutMode;
      lastScan?: import('../core/types').LastScanRecord;
      automaticScan?: boolean;
    } = {}
  ) {
    return {
      framework: overrides.framework ?? this.lastFramework?.id,
      frameworkLabel: overrides.frameworkLabel ?? this.lastFramework?.label,
      ui: overrides.ui ?? this.lastState?.ui,
      layout: overrides.layout ?? this.lastState?.layout,
      selectedCollectionId: this.lastState?.selectedCollectionId,
      selectedRequestId: this.lastState?.selectedRequestId,
      lastScan: overrides.lastScan ?? this.lastState?.lastScan,
      automaticScan: overrides.automaticScan ?? this.lastState?.automaticScan,
      runtimeVariables:
        this.lastState?.runtimeVariables ?? getRuntimeVariableStore().toVariables(),
    };
  }

  private resolveCaptureResponse(
    root: string,
    context?:
      | {
          kind?: 'collection' | 'draft' | 'adhoc';
          collectionId?: string;
          requestId?: string;
          captureResponse?: boolean;
        }
      | undefined
  ): boolean {
    if (context?.captureResponse === true) {
      return true;
    }
    if (context?.kind === 'collection' && context.requestId) {
      const found = this.collectionManager.findRequest(
        this.lastState?.collections ?? this.collectionManager.load(root),
        context.requestId
      );
      return found?.request.captureResponse ?? false;
    }
    return context?.captureResponse ?? false;
  }

  private syncRuntimeVariables(): void {
    if (!this.lastState) {
      return;
    }
    this.lastState = {
      ...this.lastState,
      runtimeVariables: getRuntimeVariableStore().toVariables(),
    };
    this.postMessage({ type: 'state', data: this.lastState });
  }

  private postMessage(message: unknown) {
    this.panel.webview.postMessage(message);
  }

  private sendTheme() {
    const root = this.getWorkspaceRoot();
    const savedTheme = root ? loadConfig(root).ui?.theme : undefined;
    if (savedTheme && isAppTheme(savedTheme)) {
      this.postMessage({ type: 'theme', theme: savedTheme });
      return;
    }
    this.postMessage({ type: 'theme', theme: resolveAppTheme() });
  }

  private getHtml(): string {
    const webview = this.panel.webview;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist', 'assets', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist', 'assets', 'index.css')
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en" data-theme="apiscope">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>APIScope</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  public dispose() {
    ApiScopePanel.currentPanel = undefined;
    this.webviewReady = false;
    this.pendingNavigation = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}

const APP_THEMES = [
  'apiscope',
  'apiscope-light',
  'solar',
  'light',
  'dark',
  'graphite',
] as const;

type AppTheme = (typeof APP_THEMES)[number];

function isAppTheme(value: string): value is AppTheme {
  return (APP_THEMES as readonly string[]).includes(value);
}

function resolveAppTheme(): AppTheme {
  const kind = vscode.window.activeColorTheme.kind;
  if (kind === vscode.ColorThemeKind.HighContrast) {
    return 'graphite';
  }
  if (kind === vscode.ColorThemeKind.Dark) {
    return 'apiscope';
  }
  return 'apiscope-light';
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

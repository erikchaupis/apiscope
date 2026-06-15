import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CollectionsSidebar, type RevealRequestTarget } from './components/CollectionsSidebar';
import { ConfirmRescanModal } from './components/ConfirmRescanModal';
import { DeleteCollectionModal } from './components/DeleteCollectionModal';
import { EnvironmentTabView } from './components/EnvironmentTabView';
import { DraftTabView } from './components/DraftTabView';
import { HistoryTabView } from './components/HistoryTabView';
import { GlobalAuthenticationTabView } from './components/GlobalAuthenticationTabView';
import { SaveDraftToCollectionModal } from './components/SaveDraftToCollectionModal';
import { RenameCollectionModal } from './components/RenameCollectionModal';
import { RequestDetails } from './components/RequestDetails';
import type { RequestEditorPanel } from './components/RequestEditorTabBar';
import { RequestResponseLayout } from './components/RequestResponseLayout';
import { RequestToolbar } from './components/RequestToolbar';
import { ResponseViewer } from './components/ResponseViewer';
import { ScanTabView } from './components/ScanTabView';
import { ScanToast } from './components/ScanToast';
import { EnvironmentToast, variableCopiedMessage } from './components/EnvironmentToast';
import { Toolbar } from './components/Toolbar';
import { WorkspaceTabBar } from './components/WorkspaceTabBar';
import { useExtensionMessages, useVsCodeApi } from './hooks/useVsCodeApi';
import { useSendRequestShortcut } from './hooks/useSendRequestShortcut';
import { useRequestResponseLayout } from './hooks/useRequestResponseLayout';
import { DEFAULT_COLLECTIONS_PANEL_WIDTH, useHorizontalResize } from './hooks/useHorizontalResize';
import { useTheme } from './hooks/useTheme';
import {
  createDefaultTabState,
  defaultRequest,
  HISTORY_TAB_ID,
  useWorkspaceTabs,
} from './hooks/useWorkspaceTabs';
import { normalizeRequestQuery } from './lib/urlQuerySync';
import { collectUploadFilePaths, normalizeRequestBody, updateMultipartFormData } from './lib/requestBody';
import { requestToPersistencePatch } from './lib/requestEditor';
import {
  generateDisplayNameFromPath,
  requestPathSubtitle,
  requestTabTitle,
} from './lib/requestDisplayName';
import type { UploadFilePathStatus } from './components/MultipartFormEditor';
import {
  buildPreviewVariableScope,
  buildRequestVariableScope,
  findMissingVariablesInRequest,
  hasTemplateVariables,
  replaceFirstPathVariable,
  resolveTemplate,
  variableSuggestionNames,
  cn,
} from './lib/utils';
import {
  GENERATED_ENVIRONMENT_ID,
  type AuthLoginPayload,
  type AuthLoginResult,
  type AuthMethodId,
  type ApiRequest,
  type ApiScopeStateJson,
  type ApiScopeUiPreferences,
  type AppTheme,
  type AuthStatus,
  type CollectionRequest,
  type ProjectInfo,
  type ScanSummary,
} from './types';

function requestTabMeta(req: CollectionRequest): { title: string; tooltip: string } {
  return {
    title: requestTabTitle(req.method, req),
    tooltip: requestPathSubtitle(req.method, req.path),
  };
}

function draftTabMeta(
  method: string,
  path: string,
  name: string
): { title: string; tooltip: string } {
  const displayName = name.trim() || generateDisplayNameFromPath(method, path);
  return {
    title: `${method} ${displayName}`,
    tooltip: requestPathSubtitle(method, path),
  };
}

const emptyProject: ProjectInfo = { detected: false };
const emptyAuth: AuthStatus = {
  authenticated: false,
  cookieCount: 0,
  jwtDetected: false,
  statusLabel: 'None',
};

function applyUploadFileToRequest(
  request: ApiRequest,
  fieldIndex: number,
  picked: { filePath: string; fileName: string; fileSize: number }
): ApiRequest | null {
  const body = normalizeRequestBody(request);
  if (body.kind !== 'multipart') {
    return null;
  }
  const formData = [...(body.formData ?? [])];
  const field = formData[fieldIndex];
  if (!field || field.type !== 'file') {
    return null;
  }
  formData[fieldIndex] = {
    ...field,
    filePath: picked.filePath,
    fileName: picked.fileName,
    fileSize: picked.fileSize,
  };
  return updateMultipartFormData(request, formData);
}

export default function App() {
  const { postMessage } = useVsCodeApi();
  const { theme, setThemeFromHost, setTheme } = useTheme();

  const [state, setState] = useState<ApiScopeStateJson | null>(null);
  const [showConfirmRescan, setShowConfirmRescan] = useState(false);
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
  const [renameCollectionId, setRenameCollectionId] = useState<string | null>(null);
  const [deleteCollectionId, setDeleteCollectionId] = useState<string | null>(null);
  const [revealRequest, setRevealRequest] = useState<RevealRequestTarget | null>(null);
  const [collectionsPanelCollapsed, setCollectionsPanelCollapsed] = useState(false);
  const [authLoginSubmitting, setAuthLoginSubmitting] = useState(false);
  const [authLoginResult, setAuthLoginResult] = useState<AuthLoginResult | null>(null);
  const [pendingEnvironmentId, setPendingEnvironmentId] = useState<string | null>(null);
  const [showSaveDraftModal, setShowSaveDraftModal] = useState(false);
  const [saveDraftTabId, setSaveDraftTabId] = useState<string | null>(null);
  const [requestEditorTab, setRequestEditorTab] = useState<RequestEditorPanel>('request');
  const [environmentToast, setEnvironmentToast] = useState<string | null>(null);

  const {
    tabs,
    activeTabId,
    activeTab,
    activeTabState,
    tabStates,
    initializedRef,
    focusTab,
    openOrFocusRequestTab,
    openOrFocusHistoryTab,
    openOrFocusEnvironmentTab,
    openOrFocusLoginTab,
    openOrFocusScanTab,
    openOrFocusDraftTab,
    closeTab,
    updateTabState,
    updateTab,
    setTabs,
  } = useWorkspaceTabs();

  const pendingExecuteTabId = useRef<string | null>(null);
  const pendingUploadPickRef = useRef<{ tabId: string; fieldIndex: number } | null>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const tabStatesRef = useRef(tabStates);
  tabStatesRef.current = tabStates;
  const [uploadFileStatuses, setUploadFileStatuses] = useState<UploadFilePathStatus[]>([]);

  const handleSaveEnvironmentVariables = useCallback(
    (environmentId: string, variables: import('./types').EnvironmentVariable[]) => {
      postMessage({ type: 'setEnvironmentVariables', environmentId, variables });
    },
    [postMessage]
  );

  const handleCopyEnvironmentVariable = useCallback(
    (
      sourceEnvironmentId: string,
      variable: import('./types').EnvironmentVariable,
      targetEnvironmentIds: string[],
      overwriteExisting: boolean
    ) => {
      postMessage({
        type: 'copyEnvironmentVariable',
        sourceEnvironmentId,
        variable,
        targetEnvironmentIds,
        overwriteExisting,
      });
    },
    [postMessage]
  );

  const handleMessage = useCallback(
    (message: import('./types').ExtensionMessage) => {
      switch (message.type) {
        case 'state':
          setState(message.data);
          if (
            !initializedRef.current &&
            message.data.selectedRequestId &&
            message.data.selectedCollectionId
          ) {
            initializedRef.current = true;
            let req: CollectionRequest | undefined;
            for (const col of message.data.collections) {
              for (const group of col.controllers) {
                req = group.requests.find((r) => r.id === message.data.selectedRequestId);
                if (req) {
                  break;
                }
              }
              if (req) {
                break;
              }
            }
            const meta = req ? requestTabMeta(req) : { title: 'Request', tooltip: undefined };
            openOrFocusRequestTab(
              message.data.selectedCollectionId,
              message.data.selectedRequestId,
              meta.title,
              meta.tooltip
            );
            postMessage({
              type: 'buildRequestForEndpoint',
              requestId: message.data.selectedRequestId,
            });
          }
          break;
        case 'theme':
          setThemeFromHost(message.theme);
          break;
        case 'error': {
          const tabId = pendingExecuteTabId.current ?? activeTabId;
          if (tabId) {
            updateTabState(tabId, {
              error: message.message,
              sending: false,
              ...(message.scriptConsoleLogs !== undefined
                ? { scriptConsoleLogs: message.scriptConsoleLogs }
                : {}),
            });
          }
          if (message.runtimeVariables !== undefined) {
            setState((prev) =>
              prev ? { ...prev, runtimeVariables: message.runtimeVariables } : prev
            );
          }
          pendingExecuteTabId.current = null;
          break;
        }
        case 'response': {
          const tabId = pendingExecuteTabId.current ?? activeTabId;
          if (tabId) {
            updateTabState(tabId, {
              response: message.data,
              sending: false,
              error: message.scriptError ?? null,
              ...(message.scriptConsoleLogs !== undefined
                ? { scriptConsoleLogs: message.scriptConsoleLogs }
                : {}),
              ...(message.testResults !== undefined ? { testResults: message.testResults } : {}),
            });
          }
          if (message.runtimeVariables !== undefined) {
            setState((prev) =>
              prev ? { ...prev, runtimeVariables: message.runtimeVariables } : prev
            );
          }
          pendingExecuteTabId.current = null;
          break;
        }
        case 'request': {
          let meta = { title: `${message.data.method} Request`, tooltip: message.data.url };
          for (const col of state?.collections ?? []) {
            if (col.id !== message.collectionId) {
              continue;
            }
            for (const group of col.controllers) {
              const req = group.requests.find((r) => r.id === message.requestId);
              if (req) {
                meta = requestTabMeta(req);
                break;
              }
            }
          }
          const tabId = openOrFocusRequestTab(
            message.collectionId,
            message.requestId,
            meta.title,
            meta.tooltip
          );
          updateTabState(tabId, {
            request: normalizeRequestQuery(message.data),
            response: null,
            error: null,
            sending: false,
          });
          break;
        }
        case 'navigateToRequest': {
          openOrFocusRequestTab(message.collectionId, message.requestId, 'Request');
          setRevealRequest({
            requestId: message.requestId,
            collectionId: message.collectionId,
            controllerName: message.controllerName,
          });
          postMessage({ type: 'buildRequestForEndpoint', requestId: message.requestId });
          break;
        }
        case 'selectRequest':
          postMessage({ type: 'buildRequestForEndpoint', requestId: message.requestId });
          break;
        case 'confirmRescan':
          setShowConfirmRescan(true);
          break;
        case 'scanSummary':
          setScanSummary(message.data);
          setShowConfirmRescan(false);
          break;
        case 'openLoginTab':
        case 'openSessionLoginModal':
          setAuthLoginResult(null);
          setAuthLoginSubmitting(false);
          openOrFocusLoginTab();
          break;
        case 'openEnvironmentTab':
          openOrFocusEnvironmentTab();
          break;
        case 'openHistoryTab':
          openOrFocusHistoryTab();
          break;
        case 'openScanTab':
          openOrFocusScanTab();
          break;
        case 'authLoginResult':
        case 'sessionLoginResult':
          setAuthLoginSubmitting(false);
          setAuthLoginResult({
            success: message.success,
            error: message.error,
            cookieNames: message.cookieNames,
          });
          break;
        case 'historyEntry':
          openOrFocusHistoryTab();
          updateTab(HISTORY_TAB_ID, { selectedHistoryId: message.data.id });
          updateTabState(HISTORY_TAB_ID, {
            historyEntry: message.data,
            response: message.data.response ?? null,
            error: message.data.error ?? null,
          });
          break;
        case 'draft': {
          const meta = draftTabMeta(message.data.method, message.data.path, message.data.name);
          const tabId = openOrFocusDraftTab(message.data.id, meta.title, meta.tooltip);
          updateTabState(tabId, {
            request: normalizeRequestQuery({
              method: message.data.method,
              url: message.data.url,
              headers: message.data.headers,
              queryParams: message.data.queryParams,
              body: message.data.body,
              requestBody: message.data.requestBody,
              authorization: message.data.authorization,
              automation: message.data.automation,
              ui: message.data.ui,
            }),
            draftName: message.data.name,
            response: null,
            error: null,
            sending: false,
          });
          break;
        }
        case 'draftDeleted':
          closeTab(`tab:draft:${message.draftId}`);
          break;
        case 'variableCopied':
          setEnvironmentToast(variableCopiedMessage(message.copiedCount));
          break;
        case 'notification':
          setEnvironmentToast(message.message);
          break;
        case 'draftSavedToCollection': {
          openOrFocusRequestTab(message.collectionId, message.requestId, 'Request');
          postMessage({ type: 'buildRequestForEndpoint', requestId: message.requestId });
          break;
        }
        case 'uploadFilePicked': {
          const pick = pendingUploadPickRef.current;
          pendingUploadPickRef.current = null;
          if (!pick) {
            break;
          }
          const tabState = tabStatesRef.current[pick.tabId];
          if (!tabState?.request) {
            break;
          }
          const next = applyUploadFileToRequest(tabState.request, pick.fieldIndex, message);
          if (!next) {
            break;
          }
          updateTabState(pick.tabId, { request: next });
          const tab = tabsRef.current.find((t) => t.id === pick.tabId);
          if (tab?.type === 'draft' && tab.draftId) {
            postMessage({
              type: 'updateDraft',
              draftId: tab.draftId,
              patch: next,
              name: tabStatesRef.current[pick.tabId]?.draftName,
            });
          } else if (tab?.type === 'request' && tab.collectionId && tab.requestId) {
            postMessage({
              type: 'updateRequest',
              collectionId: tab.collectionId,
              requestId: tab.requestId,
              patch: requestToPersistencePatch(next),
            });
          }
          break;
        }
        case 'uploadFilePathStatus':
          setUploadFileStatuses(message.results);
          break;
      }
    },
    [
      setThemeFromHost,
      postMessage,
      initializedRef,
      openOrFocusRequestTab,
      openOrFocusHistoryTab,
      openOrFocusLoginTab,
      openOrFocusScanTab,
      openOrFocusDraftTab,
      updateTabState,
      updateTab,
      closeTab,
      activeTabId,
      state?.collections,
    ]
  );

  useExtensionMessages(handleMessage);

  const { layout, toggleLayout } = useRequestResponseLayout(state?.layout);

  const handleToggleLayout = useCallback(() => {
    const next = layout === 'horizontal' ? 'vertical' : 'horizontal';
    toggleLayout();
    postMessage({ type: 'updateLayout', layout: next });
  }, [layout, toggleLayout, postMessage]);

  useEffect(() => {
    setCollectionsPanelCollapsed(state?.ui?.collectionsPanelCollapsed ?? false);
  }, [state?.ui?.collectionsPanelCollapsed]);

  useEffect(() => {
    if (pendingEnvironmentId && state?.activeEnvironmentId === pendingEnvironmentId) {
      setPendingEnvironmentId(null);
    }
  }, [state?.activeEnvironmentId, pendingEnvironmentId]);

  const updateUiPreferences = useCallback(
    (patch: ApiScopeUiPreferences) => {
      postMessage({
        type: 'updateUiPreferences',
        ui: patch,
      });
    },
    [postMessage]
  );

  const handleCollapsedChange = useCallback(
    (collapsed: boolean) => {
      setCollectionsPanelCollapsed(collapsed);
      updateUiPreferences({ collectionsPanelCollapsed: collapsed });
    },
    [updateUiPreferences]
  );

  const handleCollectionsPanelWidthCommit = useCallback(
    (width: number) => {
      updateUiPreferences({ collectionsPanelWidth: width });
    },
    [updateUiPreferences]
  );

  const savedCollectionsPanelWidth =
    state?.ui?.collectionsPanelWidth ?? DEFAULT_COLLECTIONS_PANEL_WIDTH;
  const { width: collectionsPanelWidth, onResizeStart: onCollectionsPanelResizeStart } =
    useHorizontalResize(savedCollectionsPanelWidth, handleCollectionsPanelWidthCommit);

  const handleExpandedStateChange = useCallback(
    (collectionIds: string[], folderIds: string[]) => {
      updateUiPreferences({
        expandedCollectionIds: collectionIds,
        expandedFolderIds: folderIds,
      });
    },
    [updateUiPreferences]
  );

  const handleHistoryExpandedStateChange = useCallback(
    (days: string[], signatures: string[]) => {
      updateUiPreferences({
        expandedHistoryDays: days,
        expandedHistorySignatures: signatures,
      });
    },
    [updateUiPreferences]
  );

  const handleSelectTheme = useCallback(
    (nextTheme: AppTheme) => {
      setTheme(nextTheme);
      updateUiPreferences({ theme: nextTheme });
    },
    [setTheme, updateUiPreferences]
  );

  const handleOpenHistory = useCallback(() => {
    openOrFocusHistoryTab();
  }, [openOrFocusHistoryTab]);

  const handleOpenScan = useCallback(() => {
    openOrFocusScanTab();
  }, [openOrFocusScanTab]);

  const handleScanNow = useCallback(() => {
    postMessage({ type: 'rescan' });
  }, [postMessage]);

  const handleAutomaticScanChange = useCallback(
    (enabled: boolean) => {
      postMessage({ type: 'setAutomaticScan', enabled });
    },
    [postMessage]
  );

  const handleOpenEnvironments = useCallback(() => {
    openOrFocusEnvironmentTab();
  }, [openOrFocusEnvironmentTab]);

  const handleOpenGlobalAuthentication = useCallback(() => {
    setAuthLoginResult(null);
    setAuthLoginSubmitting(false);
    openOrFocusLoginTab();
  }, [openOrFocusLoginTab]);

  const handleAuthLogin = useCallback(
    (method: AuthMethodId, payload: AuthLoginPayload) => {
      setAuthLoginSubmitting(true);
      setAuthLoginResult(null);
      postMessage({
        type: 'performAuthLogin',
        method,
        environmentId:
          pendingEnvironmentId ?? state?.activeEnvironmentId ?? GENERATED_ENVIRONMENT_ID,
        payload,
      });
    },
    [postMessage, pendingEnvironmentId, state?.activeEnvironmentId]
  );

  const handleAuthLogout = useCallback(() => {
    setAuthLoginResult(null);
    postMessage({ type: 'performAuthLogout' });
  }, [postMessage]);

  const handleSetActiveEnvironment = useCallback(
    (environmentId: string) => {
      setPendingEnvironmentId(environmentId);
      postMessage({ type: 'setActiveEnvironment', environmentId });
    },
    [postMessage]
  );

  const handleSelectHistoryEntry = useCallback(
    (historyId: string) => {
      updateTab(HISTORY_TAB_ID, { selectedHistoryId: historyId });
      postMessage({ type: 'loadHistoryEntry', historyId });
    },
    [postMessage, updateTab]
  );

  const handleCreateDraftFromHistory = useCallback(
    (historyId: string) => {
      postMessage({ type: 'createDraftFromHistory', historyId });
    },
    [postMessage]
  );

  const handleSelectRequest = useCallback(
    (requestId: string) => {
      const cols = state?.collections ?? [];
      for (const col of cols) {
        for (const group of col.controllers) {
          const req = group.requests.find((r) => r.id === requestId);
          if (req) {
            const meta = requestTabMeta(req);
            openOrFocusRequestTab(col.id, requestId, meta.title, meta.tooltip);
            postMessage({ type: 'buildRequestForEndpoint', requestId });
            return;
          }
        }
      }
      postMessage({ type: 'buildRequestForEndpoint', requestId });
    },
    [state?.collections, openOrFocusRequestTab, postMessage]
  );

  const handlePickUploadFile = useCallback(
    (fieldIndex: number) => {
      if (!activeTabId) {
        return;
      }
      pendingUploadPickRef.current = { tabId: activeTabId, fieldIndex };
      postMessage({ type: 'pickUploadFile' });
    },
    [activeTabId, postMessage]
  );

  useEffect(() => {
    const req = activeTabState?.request;
    if (!req) {
      setUploadFileStatuses([]);
      return;
    }
    const paths = collectUploadFilePaths(req);
    if (!paths.length) {
      setUploadFileStatuses([]);
      return;
    }
    postMessage({ type: 'checkUploadFilePaths', paths });
  }, [activeTabState?.request, postMessage]);

  const handleActiveRequestChange = useCallback(
    (next: ApiRequest) => {
      if (!activeTabId || !activeTab) {
        return;
      }
      updateTabState(activeTabId, { request: next });
      if (activeTab.type === 'draft' && activeTab.draftId) {
        postMessage({
          type: 'updateDraft',
          draftId: activeTab.draftId,
          patch: next,
          name: tabStates[activeTabId]?.draftName,
        });
      } else if (
        activeTab.type === 'request' &&
        activeTab.collectionId &&
        activeTab.requestId
      ) {
        postMessage({
          type: 'updateRequest',
          collectionId: activeTab.collectionId,
          requestId: activeTab.requestId,
          patch: requestToPersistencePatch(next),
        });
      }
    },
    [activeTabId, activeTab, tabStates, postMessage, updateTabState]
  );

  const handleCaptureResponseChange = useCallback(
    (enabled: boolean) => {
      if (!activeTab?.collectionId || !activeTab.requestId) {
        return;
      }
      postMessage({
        type: 'setCaptureResponse',
        collectionId: activeTab.collectionId,
        requestId: activeTab.requestId,
        captureResponse: enabled,
      });
    },
    [activeTab, postMessage]
  );

  const handleSend = useCallback(() => {
    if (!activeTabId || !activeTab || !activeTabState) {
      return;
    }
    pendingExecuteTabId.current = activeTabId;
    const lastResponse = activeTabState.response ?? null;
    updateTabState(activeTabId, {
      sending: true,
      response: null,
      error: null,
      scriptConsoleLogs: [],
      testResults: [],
    });

    const req = activeTabState.request;
    let context:
      | {
          kind: 'collection' | 'draft' | 'adhoc';
          collectionId?: string;
          requestId?: string;
          draftId?: string;
          captureResponse?: boolean;
          path?: string;
        }
      | undefined;

    if (activeTab.type === 'draft' && activeTab.draftId) {
      context = { kind: 'draft', draftId: activeTab.draftId };
    } else if (
      activeTab.type === 'request' &&
      activeTab.collectionId &&
      activeTab.requestId
    ) {
      const col = (state?.collections ?? []).find((c) => c.id === activeTab.collectionId);
      let collectionRequest: CollectionRequest | undefined;
      if (col) {
        for (const group of col.controllers) {
          collectionRequest = group.requests.find((r) => r.id === activeTab.requestId);
          if (collectionRequest) {
            break;
          }
        }
      }
      context = {
        kind: 'collection',
        collectionId: activeTab.collectionId,
        requestId: activeTab.requestId,
        captureResponse: collectionRequest?.captureResponse ?? false,
        path: collectionRequest?.path,
      };
    } else {
      context = { kind: 'adhoc' };
    }

    postMessage({
      type: 'executeRequest',
      request: req,
      context,
      lastResponse,
    });
  }, [activeTabId, activeTab, activeTabState, state?.collections, postMessage, updateTabState]);

  const project = state?.project ?? emptyProject;
  const authStatus = state?.authStatus ?? emptyAuth;
  const collections = state?.collections ?? [];
  const historyEntries = state?.history ?? [];

  useEffect(() => {
    if (collections.length === 0) {
      return;
    }
    setTabs((current) =>
      current.map((tab) => {
        if (tab.type !== 'request' || !tab.collectionId || !tab.requestId) {
          return tab;
        }
        const col = collections.find((c) => c.id === tab.collectionId);
        if (!col) {
          return tab;
        }
        for (const group of col.controllers) {
          const req = group.requests.find((r) => r.id === tab.requestId);
          if (req) {
            const meta = requestTabMeta(req);
            if (tab.title === meta.title && tab.tooltip === meta.tooltip) {
              return tab;
            }
            return { ...tab, title: meta.title, tooltip: meta.tooltip };
          }
        }
        return tab;
      })
    );
  }, [collections, setTabs]);

  const activeCollectionRequest = (() => {
    if (activeTab?.type !== 'request' || !activeTab.collectionId || !activeTab.requestId) {
      return undefined;
    }
    const col = collections.find((c) => c.id === activeTab.collectionId);
    if (!col) {
      return undefined;
    }
    for (const group of col.controllers) {
      const req = group.requests.find((r) => r.id === activeTab.requestId);
      if (req) {
        return req;
      }
    }
    return undefined;
  })();

  const activeCollection = collections.find(
    (c) =>
      c.id ===
      (activeTab?.type === 'request'
        ? activeTab.collectionId
        : state?.activeCollectionId)
  );
  const showGeneratedHint = activeCollection?.type === 'generated';
  const renameTarget = collections.find((c) => c.id === renameCollectionId);
  const deleteTarget = collections.find((c) => c.id === deleteCollectionId);
  const activeEnvironmentId =
    pendingEnvironmentId ?? state?.activeEnvironmentId ?? GENERATED_ENVIRONMENT_ID;
  const activeEnvironment =
    state?.environments.find((e) => e.id === activeEnvironmentId) ??
    state?.environments[0];
  const environmentVariables = activeEnvironment?.variables ?? [];
  const runtimeVariables = state?.runtimeVariables ?? [];

  const request = activeTabState?.request ?? defaultRequest;
  const response = activeTabState?.response ?? null;
  const previewVariableScope = useMemo(
    () =>
      buildPreviewVariableScope(request, environmentVariables, response, runtimeVariables),
    [request, environmentVariables, response, runtimeVariables]
  );
  const variableSuggestions = useMemo(
    () => variableSuggestionNames(previewVariableScope),
    [previewVariableScope]
  );
  const error = activeTabState?.error ?? null;
  const sending = activeTabState?.sending ?? false;

  const requestVariableScope = useMemo(
    () => buildRequestVariableScope(request, environmentVariables, runtimeVariables),
    [request, environmentVariables, runtimeVariables]
  );
  const missingRequestVariables = useMemo(
    () => findMissingVariablesInRequest(request, requestVariableScope),
    [request, requestVariableScope]
  );
  const canSendActiveRequest =
    (activeTab?.type === 'request' || activeTab?.type === 'draft') &&
    missingRequestVariables.length === 0;

  const modalOpen =
    showConfirmRescan ||
    showSaveDraftModal ||
    renameCollectionId !== null ||
    deleteCollectionId !== null;

  useSendRequestShortcut({
    enabled: canSendActiveRequest && !sending && !modalOpen,
    onSend: handleSend,
  });

  const resolvedRequestUrl = hasTemplateVariables(request.url)
    ? resolveTemplate(request.url, previewVariableScope)
    : /(?<!\{)\{(\w+)\}(?!\})/.test(request.url)
      ? replaceFirstPathVariable(request.url, '1')
      : request.url;

  const historyTab = tabs.find((t) => t.id === HISTORY_TAB_ID);
  const historyTabState = tabStates[HISTORY_TAB_ID] ?? createDefaultTabState();

  const saveDraftTab = saveDraftTabId ? tabs.find((t) => t.id === saveDraftTabId) : null;
  const saveDraftTabState = saveDraftTabId ? tabStates[saveDraftTabId] : null;

  const selectedRequestId =
    activeTab?.type === 'request' ? (activeTab.requestId ?? null) : null;
  const selectedCollectionId =
    activeTab?.type === 'request' ? (activeTab.collectionId ?? null) : null;

  return (
    <div className="flex flex-col h-full">
      <Toolbar
        project={project}
        authStatus={authStatus}
        showGeneratedHint={showGeneratedHint}
        environments={state?.environments ?? []}
        activeEnvironmentId={activeEnvironmentId}
        onSelectEnvironment={handleSetActiveEnvironment}
        onOpenEnvironments={handleOpenEnvironments}
        onOpenGlobalAuthentication={handleOpenGlobalAuthentication}
        onOpenHistory={handleOpenHistory}
        onOpenScan={handleOpenScan}
        onRescan={handleScanNow}
        theme={theme}
        onSelectTheme={handleSelectTheme}
      />
      <WorkspaceTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={focusTab}
        onCloseTab={closeTab}
      />
      <div className="flex flex-1 min-h-0">
        {activeTab?.type === 'request' && (
          <>
            <div
              style={collectionsPanelCollapsed ? undefined : { width: collectionsPanelWidth }}
              className={cn(
                'flex flex-col shrink-0 h-full min-h-0 bg-card overflow-hidden',
                collectionsPanelCollapsed && 'w-8 border-r border-border'
              )}
            >
              <CollectionsSidebar
            collections={collections}
            selectedCollectionId={selectedCollectionId}
            selectedRequestId={selectedRequestId}
            revealRequest={revealRequest}
            collapsed={collectionsPanelCollapsed}
            savedExpandedCollectionIds={state?.ui?.expandedCollectionIds}
            savedExpandedFolderIds={state?.ui?.expandedFolderIds}
            onCollapsedChange={handleCollapsedChange}
            onExpandedStateChange={handleExpandedStateChange}
            onSelectCollection={(id) => {
              postMessage({ type: 'selectCollection', collectionId: id });
            }}
            onSelectRequest={handleSelectRequest}
            onOpenSource={(id) => postMessage({ type: 'openSource', requestId: id })}
            onRescan={() => postMessage({ type: 'rescan' })}
            onCreateCollection={(name) => postMessage({ type: 'createCollection', name })}
            onImportCollection={() => postMessage({ type: 'importCollection' })}
            onExportCollection={(id) => postMessage({ type: 'exportCollection', collectionId: id })}
            onDuplicateCollection={(id) => postMessage({ type: 'duplicateCollection', collectionId: id })}
            onDeleteCollection={(id) => setDeleteCollectionId(id)}
            onRenameCollection={(collectionId, name) =>
              postMessage({ type: 'renameCollection', collectionId, name })
            }
            onCreateFolder={(collectionId, parentFolderId, name) =>
              postMessage({ type: 'createFolder', collectionId, parentFolderId, name })
            }
            onCreateRequest={(collectionId, parentFolderId, name) =>
              postMessage({ type: 'createRequest', collectionId, parentFolderId, name })
            }
            onRenameFolder={(collectionId, folderId, name) =>
              postMessage({ type: 'renameFolder', collectionId, folderId, name })
            }
            onDeleteFolder={(collectionId, folderId) =>
              postMessage({ type: 'deleteFolder', collectionId, folderId })
            }
            onMoveTreeNode={(collectionId, nodeId, nodeType, targetFolderId, insertBeforeId) =>
              postMessage({
                type: 'moveTreeNode',
                collectionId,
                nodeId,
                nodeType,
                targetFolderId,
                insertBeforeId,
              })
            }
            onRenameRequest={(collectionId, requestId, name) =>
              postMessage({ type: 'renameRequest', collectionId, requestId, name })
            }
            onDuplicateRequest={(collectionId, requestId) =>
              postMessage({ type: 'duplicateRequest', collectionId, requestId })
            }
            onDeleteRequest={(collectionId, requestId) =>
              postMessage({ type: 'deleteRequest', collectionId, requestId })
            }
          />
            </div>
            {!collectionsPanelCollapsed && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize collections panel"
                className="w-1 shrink-0 cursor-col-resize border-r border-border hover:bg-primary/15 active:bg-primary/25"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onCollectionsPanelResizeStart(e.clientX);
                }}
              />
            )}
          </>
        )}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          {activeTab?.type === 'login' && activeEnvironment && (
            <GlobalAuthenticationTabView
              environment={activeEnvironment}
              authStatus={authStatus}
              submitting={authLoginSubmitting}
              loginResult={authLoginResult}
              onAuthLogin={handleAuthLogin}
              onLogout={handleAuthLogout}
            />
          )}
          {activeTab?.type === 'environment' && (
            <EnvironmentTabView
              environments={state?.environments ?? []}
              activeEnvironmentId={activeEnvironmentId}
              runtimeVariables={runtimeVariables}
              onSetActiveEnvironment={handleSetActiveEnvironment}
              onCreate={(name, environmentType) =>
                postMessage({ type: 'createEnvironment', name, environmentType })
              }
              onSetEnvironmentType={(environmentId, environmentType) =>
                postMessage({ type: 'setEnvironmentType', environmentId, environmentType })
              }
              onRename={(environmentId, name) =>
                postMessage({ type: 'renameEnvironment', environmentId, name })
              }
              onDelete={(environmentId) =>
                postMessage({ type: 'deleteEnvironment', environmentId })
              }
              onDuplicate={(environmentId) =>
                postMessage({ type: 'duplicateEnvironment', environmentId })
              }
              onSaveVariables={handleSaveEnvironmentVariables}
              onCopyVariable={handleCopyEnvironmentVariable}
              onClearRuntimeVariables={() => postMessage({ type: 'clearRuntimeVariables' })}
              onDeleteRuntimeVariable={(name) =>
                postMessage({ type: 'deleteRuntimeVariable', name })
              }
              onPromoteRuntimeVariable={(name, environmentId) =>
                postMessage({ type: 'promoteRuntimeVariable', name, environmentId })
              }
            />
          )}
          {activeTab?.type === 'history' && (
            <HistoryTabView
              entries={historyEntries}
              selectedHistoryId={historyTab?.selectedHistoryId ?? null}
              historyEntry={historyTabState.historyEntry}
              savedExpandedDays={state?.ui?.expandedHistoryDays}
              savedExpandedSignatures={state?.ui?.expandedHistorySignatures}
              theme={theme}
              authStatus={authStatus}
              layout={layout}
              onExpandedStateChange={handleHistoryExpandedStateChange}
              onSelectEntry={handleSelectHistoryEntry}
              onCreateDraftFromEntry={handleCreateDraftFromHistory}
            />
          )}
          {activeTab?.type === 'scan' && (
            <ScanTabView
              lastScan={state?.lastScan}
              frameworkLabel={state?.frameworkLabel}
              automaticScan={state?.automaticScan !== false}
              onAutomaticScanChange={handleAutomaticScanChange}
              onScanNow={handleScanNow}
            />
          )}
          {activeTab?.type === 'draft' && activeTab.draftId && (
            <DraftTabView
              request={request}
              response={response}
              error={error}
              sending={sending}
              draftName={activeTabState?.draftName ?? activeTab.title}
              environmentVariables={environmentVariables}
              runtimeVariables={runtimeVariables}
              authStatus={authStatus}
              theme={theme}
              layout={layout}
              resolvedRequestUrl={resolvedRequestUrl}
              focusRequestId={activeTab.draftId}
              onChange={handleActiveRequestChange}
              onSend={handleSend}
              onToggleLayout={handleToggleLayout}
              onSaveToCollection={() => {
                setSaveDraftTabId(activeTab.id);
                setShowSaveDraftModal(true);
              }}
              onPickUploadFile={handlePickUploadFile}
              uploadFileStatuses={uploadFileStatuses}
              variableSuggestions={variableSuggestions}
            />
          )}
          {activeTab?.type === 'request' && (
            <>
              <RequestToolbar
                request={request}
                onChange={handleActiveRequestChange}
                onSend={handleSend}
                sending={sending}
                environmentVariables={environmentVariables}
                response={response}
                runtimeVariables={runtimeVariables}
                focusRequestId={selectedRequestId}
                onToggleLayout={handleToggleLayout}
                captureResponse={activeCollectionRequest?.captureResponse ?? false}
                onCaptureResponseChange={handleCaptureResponseChange}
                editorTab={requestEditorTab}
                onEditorTabChange={setRequestEditorTab}
              />
              <RequestResponseLayout
                layout={layout}
                panels={[
                  {
                    id: 'request-details',
                    content: (
                      <RequestDetails
                        request={request}
                        onChange={handleActiveRequestChange}
                        theme={theme}
                        authStatus={authStatus}
                        panel={requestEditorTab}
                        onPickUploadFile={handlePickUploadFile}
                        uploadFileStatuses={uploadFileStatuses}
                        variableSuggestions={variableSuggestions}
                        response={response}
                        scriptConsoleLogs={activeTabState?.scriptConsoleLogs}
                      />
                    ),
                  },
                  {
                    id: 'response',
                    content: (
                      <ResponseViewer
                        response={response}
                        error={error}
                        resolvedUrl={resolvedRequestUrl}
                        method={request.method}
                        sending={sending}
                        canSend={missingRequestVariables.length === 0}
                        theme={theme}
                        checks={request.automation?.responseTests ?? []}
                        storedTestResults={activeTabState?.testResults ?? []}
                        onRetry={handleSend}
                      />
                    ),
                  },
                ]}
              />
            </>
          )}
          {!activeTab && (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground p-6">
              Select a request from Collections to get started, or open History, Environments, or
              Global Authentication from the toolbar.
            </div>
          )}
        </div>
      </div>
      {showConfirmRescan && (
        <ConfirmRescanModal
          onContinue={() => postMessage({ type: 'rescanConfirmed' })}
          onCancel={() => setShowConfirmRescan(false)}
        />
      )}
      {scanSummary && (
        <ScanToast summary={scanSummary} onDismiss={() => setScanSummary(null)} />
      )}
      {environmentToast && (
        <EnvironmentToast
          message={environmentToast}
          onDismiss={() => setEnvironmentToast(null)}
        />
      )}
      {renameTarget && (
        <RenameCollectionModal
          currentName={renameTarget.name}
          onConfirm={(name) => {
            postMessage({ type: 'renameCollection', collectionId: renameTarget.id, name });
            setRenameCollectionId(null);
          }}
          onCancel={() => setRenameCollectionId(null)}
        />
      )}
      {deleteTarget && (
        <DeleteCollectionModal
          name={deleteTarget.name}
          onConfirm={() => {
            postMessage({ type: 'deleteCollection', collectionId: deleteTarget.id });
            setDeleteCollectionId(null);
          }}
          onCancel={() => setDeleteCollectionId(null)}
        />
      )}
      {showSaveDraftModal && saveDraftTab?.draftId && saveDraftTabState && (
        <SaveDraftToCollectionModal
          collections={collections}
          draftName={saveDraftTabState.draftName ?? saveDraftTab.title}
          onConfirm={(collectionId, parentFolderId) => {
            postMessage({
              type: 'saveDraftToCollection',
              draftId: saveDraftTab.draftId!,
              collectionId,
              parentFolderId,
            });
            setShowSaveDraftModal(false);
            setSaveDraftTabId(null);
          }}
          onCancel={() => {
            setShowSaveDraftModal(false);
            setSaveDraftTabId(null);
          }}
        />
      )}
    </div>
  );
}

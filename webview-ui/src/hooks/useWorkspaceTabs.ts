import { useCallback, useRef, useState } from 'react';
import type { ApiRequest, WorkspaceTab, WorkspaceTabState } from '../types';

export const HISTORY_TAB_ID = 'tab:history';
export const ENVIRONMENT_TAB_ID = 'tab:environment';
export const LOGIN_TAB_ID = 'tab:login';
export const SCAN_TAB_ID = 'tab:scan';

export const defaultRequest: ApiRequest = {
  method: 'GET',
  url: '{{baseUrl}}/',
  headers: [
    { key: 'Accept', value: 'application/json', enabled: true },
    { key: 'Content-Type', value: 'application/json', enabled: true },
  ],
  queryParams: [],
};

export function createDefaultTabState(): WorkspaceTabState {
  return {
    request: { ...defaultRequest, headers: defaultRequest.headers.map((h) => ({ ...h })) },
    response: null,
    error: null,
    sending: false,
    historyEntry: null,
  };
}

export function requestTabId(collectionId: string, requestId: string): string {
  return `tab:request:${collectionId}:${requestId}`;
}

export function draftTabId(draftId: string): string {
  return `tab:draft:${draftId}`;
}

export function useWorkspaceTabs() {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [tabStates, setTabStates] = useState<Record<string, WorkspaceTabState>>({});

  const ensureTabState = useCallback((tabId: string) => {
    setTabStates((current) => {
      if (current[tabId]) {
        return current;
      }
      return { ...current, [tabId]: createDefaultTabState() };
    });
  }, []);

  const updateTabState = useCallback((tabId: string, patch: Partial<WorkspaceTabState>) => {
    setTabStates((current) => ({
      ...current,
      [tabId]: { ...(current[tabId] ?? createDefaultTabState()), ...patch },
    }));
  }, []);

  const updateTab = useCallback((tabId: string, patch: Partial<WorkspaceTab>) => {
    setTabs((current) => current.map((t) => (t.id === tabId ? { ...t, ...patch } : t)));
  }, []);

  const focusTab = useCallback(
    (tabId: string) => {
      ensureTabState(tabId);
      setActiveTabId(tabId);
    },
    [ensureTabState]
  );

  const openOrFocusRequestTab = useCallback(
    (collectionId: string, requestId: string, title: string, tooltip?: string) => {
      const id = requestTabId(collectionId, requestId);
      setTabs((current) => {
        const existing = current.find((t) => t.id === id);
        if (existing) {
          return current.map((t) =>
            t.id === id ? { ...t, title, ...(tooltip !== undefined ? { tooltip } : {}) } : t
          );
        }
        return [...current, { id, type: 'request', title, tooltip, collectionId, requestId }];
      });
      ensureTabState(id);
      setActiveTabId(id);
      return id;
    },
    [ensureTabState]
  );

  const openOrFocusHistoryTab = useCallback(() => {
    setTabs((current) => {
      if (current.some((t) => t.id === HISTORY_TAB_ID)) {
        return current;
      }
      return [...current, { id: HISTORY_TAB_ID, type: 'history', title: 'History' }];
    });
    ensureTabState(HISTORY_TAB_ID);
    setActiveTabId(HISTORY_TAB_ID);
    return HISTORY_TAB_ID;
  }, [ensureTabState]);

  const openOrFocusEnvironmentTab = useCallback(() => {
    setTabs((current) => {
      if (current.some((t) => t.id === ENVIRONMENT_TAB_ID)) {
        return current;
      }
      return [
        ...current,
        { id: ENVIRONMENT_TAB_ID, type: 'environment', title: 'Environments' },
      ];
    });
    ensureTabState(ENVIRONMENT_TAB_ID);
    setActiveTabId(ENVIRONMENT_TAB_ID);
    return ENVIRONMENT_TAB_ID;
  }, [ensureTabState]);

  const openOrFocusLoginTab = useCallback(() => {
    setTabs((current) => {
      if (current.some((t) => t.id === LOGIN_TAB_ID)) {
        return current;
      }
      return [...current, { id: LOGIN_TAB_ID, type: 'login', title: 'Global Authentication' }];
    });
    ensureTabState(LOGIN_TAB_ID);
    setActiveTabId(LOGIN_TAB_ID);
    return LOGIN_TAB_ID;
  }, [ensureTabState]);

  const openOrFocusScanTab = useCallback(() => {
    setTabs((current) => {
      if (current.some((t) => t.id === SCAN_TAB_ID)) {
        return current;
      }
      return [...current, { id: SCAN_TAB_ID, type: 'scan', title: 'Scan' }];
    });
    ensureTabState(SCAN_TAB_ID);
    setActiveTabId(SCAN_TAB_ID);
    return SCAN_TAB_ID;
  }, [ensureTabState]);

  const openOrFocusDraftTab = useCallback(
    (draftId: string, title: string, tooltip?: string) => {
      const id = draftTabId(draftId);
      setTabs((current) => {
        const existing = current.find((t) => t.id === id);
        if (existing) {
          return current.map((t) =>
            t.id === id ? { ...t, title, ...(tooltip !== undefined ? { tooltip } : {}) } : t
          );
        }
        return [...current, { id, type: 'draft', title, tooltip, draftId }];
      });
      ensureTabState(id);
      setActiveTabId(id);
      return id;
    },
    [ensureTabState]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((current) => {
        const index = current.findIndex((t) => t.id === tabId);
        if (index < 0) {
          return current;
        }
        const next = current.filter((t) => t.id !== tabId);
        setActiveTabId((active) => {
          if (active !== tabId) {
            return active;
          }
          if (next.length === 0) {
            return null;
          }
          const neighbor = next[Math.min(index, next.length - 1)];
          return neighbor?.id ?? null;
        });
        return next;
      });
      setTabStates((current) => {
        const next = { ...current };
        delete next[tabId];
        return next;
      });
    },
    []
  );

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const activeTabState = activeTabId ? (tabStates[activeTabId] ?? createDefaultTabState()) : null;

  const initializedRef = useRef(false);

  return {
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
    ensureTabState,
    setTabs,
    setActiveTabId,
  };
}

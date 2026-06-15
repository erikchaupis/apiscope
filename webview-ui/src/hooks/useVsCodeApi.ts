import { useCallback, useEffect } from 'react';
import type { ExtensionMessage, VsCodeMessage } from '../types';

declare function acquireVsCodeApi(): {
  postMessage: (message: VsCodeMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | undefined;

function getVsCodeApi() {
  if (!vscodeApi && typeof acquireVsCodeApi !== 'undefined') {
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
}

export function useVsCodeApi() {
  const postMessage = useCallback((message: VsCodeMessage) => {
    getVsCodeApi()?.postMessage(message);
  }, []);

  useEffect(() => {
    postMessage({ type: 'webviewReady' });
  }, [postMessage]);

  return { postMessage };
}

export function useExtensionMessages(handler: (message: ExtensionMessage) => void) {
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      handler(event.data as ExtensionMessage);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [handler]);
}

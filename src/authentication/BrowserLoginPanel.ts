import * as vscode from 'vscode';
import { AuthState } from '../core/types';
import { parseCookieString } from './AuthState';
import { AuthStorage } from './AuthStorage';

export class BrowserLoginPanel {
  public static currentPanel: BrowserLoginPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly authStorage: AuthStorage;
  private disposables: vscode.Disposable[] = [];
  private loginUrl: string;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    authStorage: AuthStorage,
    loginUrl: string
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.authStorage = authStorage;
    this.loginUrl = loginUrl;
    this.panel.webview.html = this.getHtml(loginUrl);
    this.panel.webview.onDidReceiveMessage(this.handleMessage.bind(this), null, this.disposables);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public static async createOrShow(
    extensionUri: vscode.Uri,
    authStorage: AuthStorage,
    defaultUrl: string
  ) {
    const loginUrl =
      (await vscode.window.showInputBox({
        title: 'Login Like Browser',
        prompt: 'Enter the login page URL',
        value: defaultUrl,
        placeHolder: 'http://localhost:8080/login',
      })) ?? defaultUrl;

    if (BrowserLoginPanel.currentPanel) {
      BrowserLoginPanel.currentPanel.panel.reveal();
      BrowserLoginPanel.currentPanel.loginUrl = loginUrl;
      BrowserLoginPanel.currentPanel.panel.webview.html =
        BrowserLoginPanel.currentPanel.getHtml(loginUrl);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'apiScopeBrowserLogin',
      'Login Like Browser',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    BrowserLoginPanel.currentPanel = new BrowserLoginPanel(
      panel,
      extensionUri,
      authStorage,
      loginUrl
    );
  }

  private async handleMessage(message: { type: string; [key: string]: unknown }) {
    switch (message.type) {
      case 'captureAuth': {
        const cookies = typeof message.cookies === 'string' ? message.cookies : '';
        const bearerToken =
          typeof message.bearerToken === 'string' ? message.bearerToken : undefined;
        const localStorage =
          typeof message.localStorage === 'object' && message.localStorage !== null
            ? (message.localStorage as Record<string, string>)
            : {};
        const sessionStorage =
          typeof message.sessionStorage === 'object' && message.sessionStorage !== null
            ? (message.sessionStorage as Record<string, string>)
            : {};

        const state: AuthState = {
          cookies: parseCookieString(cookies),
          bearerToken: bearerToken || undefined,
          localStorage,
          sessionStorage,
          capturedAt: new Date().toISOString(),
          loginUrl: this.loginUrl,
        };

        await this.authStorage.save(state);
        vscode.window.showInformationMessage('APIScope: Authentication captured and stored securely.');
        this.panel.webview.postMessage({ type: 'authSaved' });
        break;
      }
      case 'navigate': {
        if (typeof message.url === 'string') {
          this.loginUrl = message.url;
          this.panel.webview.html = this.getHtml(message.url);
        }
        break;
      }
    }
  }

  private getHtml(loginUrl: string): string {
    const webview = this.panel.webview;
    const nonce = getNonce();
    const escapedUrl = loginUrl.replace(/"/g, '&quot;');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; frame-src http: https: ${webview.cspSource}; font-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login Like Browser</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #c9d1d9; display: flex; flex-direction: column; height: 100vh; }
    .toolbar { display: flex; gap: 8px; padding: 8px; background: #161b22; border-bottom: 1px solid #30363d; flex-wrap: wrap; align-items: center; }
    input[type="text"] { flex: 1; min-width: 200px; padding: 6px 10px; background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; border-radius: 4px; }
    button { padding: 6px 12px; background: #238636; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
    button.secondary { background: #21262d; border: 1px solid #30363d; color: #c9d1d9; }
    button:hover { opacity: 0.9; }
    iframe { flex: 1; width: 100%; border: none; background: #fff; }
    .capture-panel { padding: 12px; background: #161b22; border-top: 1px solid #30363d; max-height: 40vh; overflow-y: auto; }
    .capture-panel label { display: block; font-size: 12px; margin-bottom: 4px; color: #8b949e; }
    .capture-panel textarea { width: 100%; min-height: 48px; margin-bottom: 8px; padding: 6px; background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; border-radius: 4px; font-family: monospace; font-size: 12px; }
    .hint { font-size: 11px; color: #8b949e; margin-bottom: 8px; }
    .status { font-size: 12px; color: #7ee787; display: none; }
    .status.visible { display: block; }
  </style>
</head>
<body>
  <div class="toolbar">
    <input type="text" id="urlInput" value="${escapedUrl}" />
    <button class="secondary" id="goBtn">Go</button>
    <button id="captureBtn">Capture Authentication</button>
  </div>
  <iframe id="loginFrame" src="${escapedUrl}" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"></iframe>
  <div class="capture-panel">
    <p class="hint">After logging in via the browser above, paste cookies from DevTools (Application → Cookies) or your session token below. Data is stored securely via VS Code Secret Storage.</p>
    <label for="cookies">Cookies (name=value; ...)</label>
    <textarea id="cookies" placeholder="JSESSIONID=abc123; XSRF-TOKEN=..."></textarea>
    <label for="bearer">Bearer Token (optional)</label>
    <textarea id="bearer" placeholder="eyJhbGciOiJIUzI1NiIs..."></textarea>
    <label for="localStorage">Local Storage JSON (optional)</label>
    <textarea id="localStorage" placeholder='{"access_token":"..."}'></textarea>
    <label for="sessionStorage">Session Storage JSON (optional)</label>
    <textarea id="sessionStorage" placeholder="{}"></textarea>
    <p class="status" id="status">Authentication saved.</p>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const urlInput = document.getElementById('urlInput');
    const loginFrame = document.getElementById('loginFrame');
    document.getElementById('goBtn').addEventListener('click', () => {
      const url = urlInput.value.trim();
      if (url) {
        loginFrame.src = url;
        vscode.postMessage({ type: 'navigate', url });
      }
    });
    document.getElementById('captureBtn').addEventListener('click', () => {
      let localStorage = {};
      let sessionStorage = {};
      try {
        const ls = document.getElementById('localStorage').value.trim();
        if (ls) localStorage = JSON.parse(ls);
      } catch (e) {}
      try {
        const ss = document.getElementById('sessionStorage').value.trim();
        if (ss) sessionStorage = JSON.parse(ss);
      } catch (e) {}
      vscode.postMessage({
        type: 'captureAuth',
        cookies: document.getElementById('cookies').value.trim(),
        bearerToken: document.getElementById('bearer').value.trim(),
        localStorage,
        sessionStorage,
      });
    });
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'authSaved') {
        document.getElementById('status').classList.add('visible');
      }
    });
  </script>
</body>
</html>`;
  }

  private dispose() {
    BrowserLoginPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

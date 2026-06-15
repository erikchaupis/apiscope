import * as vscode from 'vscode';
import { ApiScopePanel } from '../webview/ApiScopePanel';

export function registerSidebarCommands(context: vscode.ExtensionContext): void {
  const ensurePanel = () => {
    if (!ApiScopePanel.currentPanel) {
      ApiScopePanel.createOrShow(context.extensionUri, context);
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('apiScope.openEnvironmentsTab', () => {
      ensurePanel();
      ApiScopePanel.currentPanel?.openEnvironmentTab();
    }),

    vscode.commands.registerCommand('apiScope.openHistoryTab', () => {
      ensurePanel();
      ApiScopePanel.currentPanel?.openHistoryTab();
    }),

    vscode.commands.registerCommand('apiScope.openScanTab', () => {
      ensurePanel();
      ApiScopePanel.currentPanel?.openScanTab();
    }),

    vscode.commands.registerCommand('apiScope.openLoginTab', () => {
      ensurePanel();
      ApiScopePanel.currentPanel?.openLoginTab();
    })
  );
}

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { isImageContentType } from '../core/fileResponse';
import type { ApiResponse } from '../core/types';
import {
  absoluteDownloadPath,
  copyDownloadToDestination,
  downloadFileExists,
} from '../storage/DownloadStorage';

export interface EnrichedFileResponse {
  stored: boolean;
  fileName: string;
  contentType: string;
  size: number;
  downloadPath: string;
  fileExists: boolean;
  previewUri?: string;
}

export interface EnrichedApiResponse extends ApiResponse {
  fileResponse?: EnrichedFileResponse;
}

export function enrichApiResponse(
  workspaceRoot: string,
  webview: vscode.Webview,
  response: ApiResponse
): EnrichedApiResponse {
  if (!response.fileResponse) {
    return response;
  }

  const fileExists = downloadFileExists(workspaceRoot, response.fileResponse.downloadPath);
  const enriched: EnrichedFileResponse = {
    ...response.fileResponse,
    fileExists,
  };

  if (fileExists && isImageContentType(response.fileResponse.contentType)) {
    const absPath = absoluteDownloadPath(workspaceRoot, response.fileResponse.downloadPath);
    enriched.previewUri = webview.asWebviewUri(vscode.Uri.file(absPath)).toString();
  }

  return {
    ...response,
    fileResponse: enriched,
  };
}

export function enrichHistoryEntryResponse(
  workspaceRoot: string,
  webview: vscode.Webview,
  entry: import('../core/historyTypes').HistoryEntry
): import('../core/historyTypes').HistoryEntry {
  if (!entry.response?.fileResponse) {
    return entry;
  }
  return {
    ...entry,
    response: enrichApiResponse(workspaceRoot, webview, entry.response),
  };
}

export async function saveDownloadToUserLocation(
  workspaceRoot: string,
  downloadPath: string,
  suggestedFileName: string
): Promise<void> {
  const source = absoluteDownloadPath(workspaceRoot, downloadPath);
  if (!fs.existsSync(source)) {
    throw new Error('Downloaded file not found');
  }

  const destination = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(suggestedFileName),
    saveLabel: 'Save',
  });
  if (!destination) {
    return;
  }

  await copyDownloadToDestination(workspaceRoot, downloadPath, destination.fsPath);
  vscode.window.showInformationMessage(`Saved ${path.basename(destination.fsPath)}`);
}

export async function revealDownloadInFolder(
  workspaceRoot: string,
  downloadPath: string
): Promise<void> {
  const source = absoluteDownloadPath(workspaceRoot, downloadPath);
  if (!fs.existsSync(source)) {
    throw new Error('Downloaded file not found');
  }
  await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(source));
}

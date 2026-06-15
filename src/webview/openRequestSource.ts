import * as vscode from 'vscode';
import { resolveSourcePath } from '../core/pathUtils';
import type { CollectionRequest } from '../core/types';

export async function openCollectionRequestSource(
  workspaceRoot: string,
  request: CollectionRequest
): Promise<boolean> {
  const sourceFile = request.sourceFile;
  const sourcePath = resolveRequestSourcePath(workspaceRoot, request);
  if (!sourceFile || !sourcePath) {
    return false;
  }
  await openRequestSource(workspaceRoot, sourceFile, resolveRequestSourceLine(request));
  return true;
}

export async function openRequestSource(
  workspaceRoot: string,
  sourceFile: string,
  sourceLine?: number
): Promise<void> {
  const absolutePath = resolveSourcePath(workspaceRoot, sourceFile);
  const uri = vscode.Uri.file(absolutePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  const lineIndex = Math.max(0, (sourceLine ?? 1) - 1);
  const lineText = doc.lineAt(Math.min(lineIndex, doc.lineCount - 1)).text;
  const range = new vscode.Range(lineIndex, 0, lineIndex, lineText.length);

  const editor = await vscode.window.showTextDocument(doc, {
    viewColumn: vscode.ViewColumn.Active,
    preview: false,
    preserveFocus: false,
    selection: new vscode.Selection(range.start, range.end),
  });

  editor.selection = new vscode.Selection(range.start, range.end);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
}

export function resolveRequestSourcePath(
  workspaceRoot: string,
  request: { sourceFile?: string; filePath?: string }
): string | undefined {
  if (request.sourceFile) {
    return resolveSourcePath(workspaceRoot, request.sourceFile);
  }
  return request.filePath;
}

export function resolveRequestSourceLine(
  request: { sourceLine?: number; line?: number }
): number | undefined {
  return request.sourceLine ?? request.line;
}

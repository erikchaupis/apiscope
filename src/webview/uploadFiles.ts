import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface PickedUploadFile {
  filePath: string;
  fileName: string;
  fileSize: number;
}

export interface UploadFilePathStatus {
  filePath: string;
  exists: boolean;
  fileName: string;
  fileSize?: number;
}

export async function pickUploadFile(): Promise<PickedUploadFile | undefined> {
  const selection = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: 'Select file',
  });
  if (!selection?.length) {
    return undefined;
  }

  const uri = selection[0];
  const filePath = uri.fsPath;
  const stat = fs.statSync(filePath);
  return {
    filePath,
    fileName: path.basename(filePath),
    fileSize: stat.size,
  };
}

export function checkUploadFilePaths(filePaths: string[]): UploadFilePathStatus[] {
  return filePaths.map((filePath) => {
    const fileName = path.basename(filePath);
    if (!filePath.trim()) {
      return { filePath, exists: false, fileName };
    }
    try {
      const stat = fs.statSync(filePath);
      return {
        filePath,
        exists: stat.isFile(),
        fileName,
        fileSize: stat.isFile() ? stat.size : undefined,
      };
    } catch {
      return { filePath, exists: false, fileName };
    }
  });
}

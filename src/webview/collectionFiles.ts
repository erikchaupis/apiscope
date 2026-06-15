import * as fs from 'fs';
import * as vscode from 'vscode';
import {
  COLLECTION_EXPORT_EXTENSION,
  type CollectionExportDocument,
  parseCollectionExportDocument,
  serializeCollectionExportDocument,
  suggestedCollectionExportFileName,
} from '../collections/collectionImportExport';

const COLLECTION_FILE_FILTER = {
  'APIScope Collection': [COLLECTION_EXPORT_EXTENSION.slice(1), 'json'],
};

export interface PickedCollectionImportFile {
  filePath: string;
  content: string;
}

export async function pickCollectionImportFile(): Promise<PickedCollectionImportFile | undefined> {
  const selection = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: 'Import Collection',
    filters: COLLECTION_FILE_FILTER,
  });
  if (!selection?.length) {
    return undefined;
  }

  const filePath = selection[0].fsPath;
  const content = fs.readFileSync(filePath, 'utf-8');
  return { filePath, content };
}

export async function saveCollectionExportFile(
  document: CollectionExportDocument
): Promise<string | undefined> {
  const destination = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(suggestedCollectionExportFileName(document.collection.name)),
    saveLabel: 'Export Collection',
    filters: COLLECTION_FILE_FILTER,
  });
  if (!destination) {
    return undefined;
  }

  fs.writeFileSync(destination.fsPath, serializeCollectionExportDocument(document), 'utf-8');
  return destination.fsPath;
}

export function readCollectionImportDocument(content: string) {
  return parseCollectionExportDocument(content);
}

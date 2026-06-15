import { Collection, ScanSummary } from '../core/types';
import { CollectionManager } from '../collections/CollectionManager';
import { EnvironmentManager } from '../environment/EnvironmentManager';
import { getScannerForProject } from './ScannerRegistry';

export interface WorkspaceScanResult {
  collections: Collection[];
  summary: ScanSummary;
  frameworkId: string;
  frameworkLabel: string;
}

export async function performWorkspaceScan(
  workspaceRoot: string
): Promise<WorkspaceScanResult | null> {
  const scanner = await getScannerForProject(workspaceRoot);
  if (!scanner) {
    return null;
  }

  const envManager = new EnvironmentManager();
  const collectionManager = new CollectionManager(envManager);
  const endpoints = await scanner.scan({ workspaceRoot });
  await envManager.refreshGeneratedEnvironment(workspaceRoot);
  const collections = collectionManager.load(workspaceRoot);
  const { collections: updated, summary } = await collectionManager.applyScan(
    workspaceRoot,
    collections,
    endpoints,
    scanner.frameworkId
  );

  return {
    collections: updated,
    summary,
    frameworkId: scanner.frameworkId,
    frameworkLabel: scanner.frameworkLabel,
  };
}

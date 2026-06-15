import { FrameworkScanner } from './FrameworkScanner';
import { getScannerForProject } from './ScannerRegistry';

export interface ProjectFrameworkInfo {
  detected: boolean;
  label: string;
  frameworkId?: string;
}

export async function detectProjectFramework(
  workspaceRoot: string
): Promise<ProjectFrameworkInfo> {
  const scanner = await getScannerForProject(workspaceRoot);
  if (!scanner) {
    return { detected: false, label: '' };
  }

  return {
    detected: true,
    label: scanner.frameworkLabel,
    frameworkId: scanner.frameworkId,
  };
}

export async function getProjectScanner(
  workspaceRoot: string
): Promise<FrameworkScanner | undefined> {
  return getScannerForProject(workspaceRoot);
}

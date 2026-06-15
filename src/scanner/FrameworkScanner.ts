import { Endpoint } from '../core/types';

export interface ScanContext {
  workspaceRoot: string;
  sourcePaths?: string[];
}

export interface FrameworkScanner {
  readonly frameworkId: string;
  readonly frameworkLabel: string;
  canScan(workspaceRoot: string): Promise<boolean>;
  scan(context: ScanContext): Promise<Endpoint[]>;
}

import { Endpoint } from '../core/types';
import { FrameworkScanner, ScanContext } from '../scanner/FrameworkScanner';
import { detectExpressProject } from './ExpressProjectDetector';
import { scanExpressRoutes } from './ExpressRouteParser';

export class ExpressScanner implements FrameworkScanner {
  readonly frameworkId = 'express';
  readonly frameworkLabel = 'Node.js / Express';

  async canScan(workspaceRoot: string): Promise<boolean> {
    const info = await detectExpressProject(workspaceRoot);
    return info.detected;
  }

  async scan(context: ScanContext): Promise<Endpoint[]> {
    return scanExpressRoutes(context.workspaceRoot, context.sourcePaths);
  }
}

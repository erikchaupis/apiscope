import { FrameworkScanner, ScanContext } from '../scanner/FrameworkScanner';
import { detectFastApiProject } from './FastApiProjectDetector';
import { scanFastApiRoutes } from './FastApiRouteParser';

export class FastApiScanner implements FrameworkScanner {
  readonly frameworkId = 'fastapi';
  readonly frameworkLabel = 'Python / FastAPI';

  async canScan(workspaceRoot: string): Promise<boolean> {
    const info = await detectFastApiProject(workspaceRoot);
    return info.detected;
  }

  async scan(context: ScanContext): Promise<import('../core/types').Endpoint[]> {
    return scanFastApiRoutes(context.workspaceRoot, context.sourcePaths);
  }
}

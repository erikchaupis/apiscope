import { FrameworkScanner } from './FrameworkScanner';
import { ExpressScanner } from '../express-scanner/ExpressScanner';
import { FastApiScanner } from '../fastapi-scanner/FastApiScanner';
import { SpringScanner } from '../spring-scanner/SpringScanner';

const scanners: FrameworkScanner[] = [new SpringScanner(), new ExpressScanner(), new FastApiScanner()];

export async function getScannerForProject(
  workspaceRoot: string
): Promise<FrameworkScanner | undefined> {
  for (const scanner of scanners) {
    if (await scanner.canScan(workspaceRoot)) {
      return scanner;
    }
  }
  return undefined;
}

export function getAllScanners(): FrameworkScanner[] {
  return [...scanners];
}

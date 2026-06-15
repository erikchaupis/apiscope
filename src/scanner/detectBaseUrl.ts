import { getScannerForProject } from './ScannerRegistry';
import { detectExpressBaseUrl } from '../express-scanner/ExpressBaseUrlDetector';
import { detectFastApiBaseUrl } from '../fastapi-scanner/FastApiBaseUrlDetector';
import { detectBaseUrl as detectSpringBaseUrl } from '../spring-scanner/SpringBaseUrlDetector';

export async function detectBaseUrlForProject(workspaceRoot: string): Promise<string> {
  const scanner = await getScannerForProject(workspaceRoot);
  if (scanner?.frameworkId === 'express') {
    return detectExpressBaseUrl(workspaceRoot);
  }
  if (scanner?.frameworkId === 'fastapi') {
    return detectFastApiBaseUrl(workspaceRoot);
  }
  return detectSpringBaseUrl(workspaceRoot);
}

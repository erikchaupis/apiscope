import {
  DEFAULT_EXPANDED_REQUEST_SECTIONS,
  type ApiRequest,
  type AuthStatus,
  type RequestAuthorization,
  type RequestAuthorizationType,
  type RequestAutomation,
  type RequestUi,
} from '../types';
import { authMethodLabel } from './authMethods';

export function defaultRequestAuthorization(): RequestAuthorization {
  return { type: 'inherit' };
}

export function getRequestAuthorization(request: ApiRequest): RequestAuthorization {
  return request.authorization ?? defaultRequestAuthorization();
}

export function getRequestAutomation(request: ApiRequest): RequestAutomation {
  return {
    preRequest: request.automation?.preRequest ?? '',
    postRequest: request.automation?.postRequest ?? '',
    tests: request.automation?.tests ?? '',
    preRequestVariables: request.automation?.preRequestVariables ?? [],
    postRequestVariables: request.automation?.postRequestVariables ?? [],
    responseTests: request.automation?.responseTests ?? [],
  };
}

export function getExpandedSections(ui?: RequestUi): string[] {
  return ui?.expandedSections ?? [...DEFAULT_EXPANDED_REQUEST_SECTIONS];
}

export function isSectionExpanded(ui: RequestUi | undefined, sectionId: string): boolean {
  return getExpandedSections(ui).includes(sectionId);
}

export function toggleExpandedSection(ui: RequestUi | undefined, sectionId: string): RequestUi {
  const current = getExpandedSections(ui);
  const next = current.includes(sectionId)
    ? current.filter((id) => id !== sectionId)
    : [...current, sectionId];
  return { expandedSections: next };
}

export function requestToPersistencePatch(request: ApiRequest) {
  return {
    method: request.method,
    url: request.url,
    headers: request.headers,
    queryParams: request.queryParams,
    body: request.body,
    requestBody: request.requestBody,
    authorization: request.authorization,
    automation: request.automation,
    ui: request.ui,
  };
}

export const AUTOMATION_SCRIPT_PLACEHOLDERS = {
  preRequest: '// Pre-request script',
  postRequest: '// Post-request script',
  tests: '// Tests',
} as const;

export const REQUEST_AUTHORIZATION_LABELS: Record<RequestAuthorizationType, string> = {
  inherit: 'Inherit',
  none: 'None',
  session: 'Session',
  bearer: 'Bearer Token',
  basic: 'Basic Auth',
  'api-key': 'API Key',
};

export function resolveEffectiveAuthenticationType(
  authorization: RequestAuthorization | undefined,
  globalAuth: AuthStatus
): RequestAuthorizationType {
  const type = authorization?.type ?? 'inherit';
  if (type !== 'inherit') {
    return type;
  }
  if (!globalAuth.authenticated || !globalAuth.method) {
    return 'none';
  }
  return globalAuth.method;
}

export function effectiveAuthenticationLabel(
  authorization: RequestAuthorization | undefined,
  globalAuth: AuthStatus
): string {
  return REQUEST_AUTHORIZATION_LABELS[resolveEffectiveAuthenticationType(authorization, globalAuth)];
}

export function globalAuthenticationLabel(globalAuth: AuthStatus): string {
  if (!globalAuth.authenticated || !globalAuth.method) {
    return 'None';
  }
  return authMethodLabel(globalAuth.method);
}

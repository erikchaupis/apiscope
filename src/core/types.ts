export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type CollectionType = 'generated' | 'user';

export const AUTO_GENERATED_COLLECTION_NAME = 'Generated Collection';
export const AUTO_GENERATED_COLLECTION_ID = 'auto-generated';
export const GENERATED_ENVIRONMENT_ID = 'generated';
export const GENERATED_ENVIRONMENT_NAME = 'Generated Environment';
/** @deprecated Use GENERATED_ENVIRONMENT_ID */
export const DEFAULT_ENVIRONMENT_ID = GENERATED_ENVIRONMENT_ID;
/** Whether the environment was auto-generated from project scan or created by the user. */
export type EnvironmentSource = 'generated' | 'user';

/** Target deployment tier for visual identification and safety. */
export type EnvironmentTier = 'LOCAL' | 'DEV' | 'UAT' | 'STAGING' | 'PROD' | 'CUSTOM';

/** @deprecated Use EnvironmentSource */
export type EnvironmentType = EnvironmentSource;

export const ENVIRONMENT_TIERS: EnvironmentTier[] = [
  'LOCAL',
  'DEV',
  'UAT',
  'STAGING',
  'PROD',
  'CUSTOM',
];

export const DEFAULT_ENVIRONMENT_TIER: EnvironmentTier = 'DEV';
export const CONFIG_VERSION = 2;

import type { DraftSummary, HistoryIndexEntry } from './historyTypes';

export function requestSourceKey(controllerName: string, method: HttpMethod, path: string): string {
  return `${controllerName}:${method}:${path}`;
}

export function requestLabel(method: HttpMethod, path: string): string {
  return `${method} ${path}`;
}

export interface Endpoint {
  id: string;
  method: HttpMethod;
  path: string;
  controllerName: string;
  collectionName: string;
  filePath: string;
  line?: number;
  summary?: string;
  operationId?: string;
}

export interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
}

export type RequestAuthorizationType =
  | 'inherit'
  | 'none'
  | 'session'
  | 'bearer'
  | 'basic'
  | 'api-key';

export interface RequestAuthorization {
  type: RequestAuthorizationType;
  bearerToken?: string;
  bearerPrefix?: string;
  basicUsername?: string;
  basicPassword?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyIn?: 'header' | 'query';
}

export type PreRequestVariableType =
  | 'static'
  | 'uuid'
  | 'timestamp'
  | 'random-number'
  | 'random-string'
  | 'random-email';

export type TimestampFormat = 'unix-seconds' | 'unix-milliseconds' | 'iso-8601';

export interface PreRequestVariable {
  name: string;
  type: PreRequestVariableType;
  enabled: boolean;
  staticValue?: string;
  timestampFormat?: TimestampFormat;
  min?: number;
  max?: number;
  length?: number;
  domain?: string;
}

export type PostRequestVariableSource = 'body' | 'headers' | 'cookies';

export interface PostRequestVariable {
  name: string;
  source: PostRequestVariableSource;
  enabled: boolean;
  jsonPath?: string;
  headerName?: string;
  cookieName?: string;
}

export type ResponseTestCheckType =
  | 'status-code'
  | 'response-time'
  | 'response-size'
  | 'response-header'
  | 'response-cookie'
  | 'json-field';

export type ResponseTestOperator =
  | 'exists'
  | 'equals'
  | 'not-equals'
  | 'contains'
  | 'greater-than'
  | 'less-than'
  | 'is-empty'
  | 'is-not-empty';

export interface ResponseTestCheck {
  id: string;
  type: ResponseTestCheckType;
  enabled: boolean;
  operator: ResponseTestOperator;
  value?: string;
  headerName?: string;
  cookieName?: string;
  jsonPath?: string;
}

export interface ResponseTestResult {
  checkId: string;
  name: string;
  passed: boolean;
  actual?: string;
  expected?: string;
  conditionFailed?: boolean;
}

export interface RequestAutomation {
  preRequest?: string;
  postRequest?: string;
  tests?: string;
  preRequestVariables?: PreRequestVariable[];
  postRequestVariables?: PostRequestVariable[];
  responseTests?: ResponseTestCheck[];
}

export interface RequestUi {
  expandedSections?: string[];
}

export const DEFAULT_EXPANDED_REQUEST_SECTIONS = [
  'params',
  'headers',
  'body',
] as const;

export interface ApiRequest {
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  body?: string;
  requestBody?: import('./requestBody').RequestBody;
  authorization?: RequestAuthorization;
  automation?: RequestAutomation;
  ui?: RequestUi;
}

export interface CollectionRequest {
  id: string;
  name?: string;
  displayName?: string;
  displayNameOverride?: boolean;
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  body?: string;
  requestBody?: import('./requestBody').RequestBody;
  sourceKey?: string;
  path: string;
  sourceFile?: string;
  sourceLine?: number;
  /** @deprecated Resolved at load time for backward compatibility */
  filePath?: string;
  /** @deprecated Resolved at load time for backward compatibility */
  line?: number;
  captureResponse?: boolean;
  authorization?: RequestAuthorization;
  automation?: RequestAutomation;
  ui?: RequestUi;
}

export interface CollectionIndexEntry {
  id: string;
  name: string;
  type: CollectionType;
}

export interface CollectionsIndex {
  collections: CollectionIndexEntry[];
}

export interface CollectionMetadata {
  id: string;
  name: string;
  type: CollectionType;
  createdAt: string;
  updatedAt: string;
  isDirty?: boolean;
}

export type TreeNodeType = 'folder' | 'request';

export interface TreeRef {
  id: string;
  type: TreeNodeType;
}

export interface FolderNode {
  id: string;
  type: 'folder';
  name: string;
  children: string[];
}

export interface TreeDocument {
  root: TreeRef[];
  nodes: Record<string, FolderNode>;
}

/** Request as stored on disk (no resolved absolute paths). */
export interface StoredRequest {
  id: string;
  name?: string;
  displayName?: string;
  displayNameOverride?: boolean;
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  body?: string;
  requestBody?: import('./requestBody').RequestBody;
  sourceKey?: string;
  path: string;
  sourceFile?: string;
  sourceLine?: number;
  captureResponse?: boolean;
  authorization?: RequestAuthorization;
  automation?: RequestAutomation;
  ui?: RequestUi;
}

export interface ControllerGroup {
  name: string;
  requests: CollectionRequest[];
}

export interface Collection {
  id: string;
  name: string;
  type: CollectionType;
  createdAt: string;
  updatedAt: string;
  isDirty?: boolean;
  controllers: ControllerGroup[];
  tree: TreeDocument;
}

export interface EnvironmentVariable {
  name: string;
  value: string;
  sensitive?: boolean;
}

export interface EnvironmentIndexEntry {
  id: string;
  name: string;
  source: EnvironmentSource;
  environmentType: EnvironmentTier;
}

export interface EnvironmentsIndex {
  environments: EnvironmentIndexEntry[];
}

export interface Environment {
  id: string;
  name: string;
  source: EnvironmentSource;
  environmentType: EnvironmentTier;
  variables: EnvironmentVariable[];
  /** Reserved for future user-defined badge colors. */
  customColor?: string;
}

export interface ScanSummary {
  added: string[];
  updated: string[];
  removed: string[];
  endpointCount?: number;
}

export interface LastScanRecord {
  framework: string;
  controllers: number;
  endpoints: number;
  lastScan: string;
  added: number;
  updated: number;
  removed: number;
  addedLabels: string[];
  updatedLabels: string[];
  removedLabels: string[];
}

export type RequestResponseLayoutMode = 'horizontal' | 'vertical';

export type AppTheme =
  | 'apiscope'
  | 'apiscope-light'
  | 'solar'
  | 'light'
  | 'dark'
  | 'graphite';

export interface ApiScopeUiPreferences {
  collectionsPanelCollapsed?: boolean;
  /** Width in px for the collections sidebar when expanded. Defaults to 256. */
  collectionsPanelWidth?: number;
  expandedCollectionIds?: string[];
  expandedControllerGroups?: string[];
  expandedFolderIds?: string[];
  expandedHistoryDays?: string[];
  expandedHistorySignatures?: string[];
  /** Manual theme override; when set, editor theme sync is skipped. */
  theme?: AppTheme;
}

export interface ApiScopeConfig {
  version: number;
  activeCollectionId: string;
  activeEnvironmentId: string;
  lastScan?: string;
  /** When false, skip automatic scan on workspace open. Defaults to true. */
  automaticScan?: boolean;
  layout?: RequestResponseLayoutMode;
  ui?: ApiScopeUiPreferences;
}

export type AuthMethodId = 'session' | 'basic' | 'bearer' | 'api-key';

export type ApiKeyLocation = 'header' | 'query';

export interface AuthCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

export interface AuthState {
  method?: AuthMethodId;
  cookies: AuthCookie[];
  bearerToken?: string;
  bearerPrefix?: string;
  basicUsername?: string;
  basicPassword?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyIn?: ApiKeyLocation;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  capturedAt: string;
  loginUrl?: string;
  environmentId?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  method?: AuthMethodId;
  environmentId?: string;
  cookieCount: number;
  sessionCookieNames?: string[];
  bearerExpiration?: string;
  statusLabel: string;
  /** @deprecated Use bearerExpiration */
  jwtDetected?: boolean;
  /** @deprecated Use bearerExpiration */
  jwtExpiration?: string;
}

export interface ApiResponse {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
  fileResponse?: import('./fileResponse').FileResponseMetadata;
}

export interface ProjectInfo {
  detected: boolean;
  framework?: string;
  label?: string;
}

export interface ApiScopeStateJson {
  project: ProjectInfo;
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string;
  activeCollectionId: string;
  authStatus: AuthStatus;
  runtimeVariables?: EnvironmentVariable[];
  selectedCollectionId?: string;
  selectedRequestId?: string;
  framework?: string;
  frameworkLabel?: string;
  layout?: RequestResponseLayoutMode;
  ui?: ApiScopeUiPreferences;
  history?: HistoryIndexEntry[];
  drafts?: DraftSummary[];
  lastScan?: LastScanRecord;
  automaticScan?: boolean;
}

export function getAllRequests(collection: Collection): CollectionRequest[] {
  return collection.controllers.flatMap((g) => g.requests);
}

export function toJson(
  collections: Collection[],
  environments: Environment[],
  activeEnvironmentId: string,
  activeCollectionId: string,
  project: ProjectInfo,
  authStatus: AuthStatus,
  extras?: {
    selectedCollectionId?: string;
    selectedRequestId?: string;
    framework?: string;
    frameworkLabel?: string;
    layout?: RequestResponseLayoutMode;
    ui?: ApiScopeUiPreferences;
    history?: HistoryIndexEntry[];
    drafts?: DraftSummary[];
    lastScan?: LastScanRecord;
    automaticScan?: boolean;
    runtimeVariables?: EnvironmentVariable[];
  }
): ApiScopeStateJson {
  return {
    project,
    collections,
    environments,
    activeEnvironmentId,
    activeCollectionId,
    authStatus,
    ...extras,
  };
}

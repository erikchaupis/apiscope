export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type AppTheme = 'apiscope' | 'apiscope-light' | 'solar' | 'light' | 'dark' | 'graphite';
export type CollectionType = 'generated' | 'user';

export const GENERATED_ENVIRONMENT_ID = 'generated';

export type EnvironmentSource = 'generated' | 'user';

export type EnvironmentTier = 'LOCAL' | 'DEV' | 'UAT' | 'STAGING' | 'PROD' | 'CUSTOM';

export const ENVIRONMENT_TIERS: EnvironmentTier[] = [
  'LOCAL',
  'DEV',
  'UAT',
  'STAGING',
  'PROD',
  'CUSTOM',
];

export const DEFAULT_ENVIRONMENT_TIER: EnvironmentTier = 'DEV';

export interface EnvironmentVariable {
  name: string;
  value: string;
  sensitive?: boolean;
}

export interface Environment {
  id: string;
  name: string;
  source: EnvironmentSource;
  environmentType: EnvironmentTier;
  variables: EnvironmentVariable[];
  customColor?: string;
}

export interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
}

export type RequestBodyKind = 'none' | 'json' | 'form-urlencoded' | 'raw' | 'multipart';

export type MultipartFieldType = 'text' | 'file';

export interface MultipartTextField {
  key: string;
  type: 'text';
  value: string;
  enabled: boolean;
}

export interface MultipartFileField {
  key: string;
  type: 'file';
  filePath: string;
  fileName?: string;
  fileSize?: number;
  enabled: boolean;
}

export type MultipartFormField = MultipartTextField | MultipartFileField;

export interface RequestBody {
  kind: RequestBodyKind;
  content?: string;
  urlEncoded?: KeyValuePair[];
  formData?: MultipartFormField[];
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
  requestBody?: RequestBody;
  sourceKey?: string;
  path: string;
  sourceFile?: string;
  sourceLine?: number;
  filePath?: string;
  line?: number;
  captureResponse?: boolean;
  authorization?: RequestAuthorization;
  automation?: RequestAutomation;
  ui?: RequestUi;
}

export interface ControllerGroup {
  name: string;
  requests: CollectionRequest[];
}

export interface TreeRef {
  id: string;
  type: 'folder' | 'request';
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

export interface Collection {
  id: string;
  name: string;
  type: CollectionType;
  controllers: ControllerGroup[];
  tree: TreeDocument;
  createdAt: string;
  updatedAt: string;
  isDirty?: boolean;
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

export interface AuthStatus {
  authenticated: boolean;
  method?: AuthMethodId;
  environmentId?: string;
  cookieCount: number;
  sessionCookieNames?: string[];
  bearerExpiration?: string;
  statusLabel: string;
  /** @deprecated */
  jwtDetected?: boolean;
  /** @deprecated */
  jwtExpiration?: string;
}

export type AuthMethodId = 'session' | 'basic' | 'bearer' | 'api-key';

export type ApiKeyLocation = 'header' | 'query';

export type AuthLoginPayload =
  | { loginUrl: string; username: string; password: string }
  | { token: string; prefix?: string }
  | { username: string; password: string }
  | { name: string; value: string; addTo?: ApiKeyLocation };

export interface AuthLoginResult {
  success: boolean;
  error?: string;
  cookieNames?: string[];
}

export interface ProjectInfo {
  detected: boolean;
  framework?: string;
  label?: string;
}

export type RequestResponseLayoutMode = 'horizontal' | 'vertical';

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

export type WorkspaceTabType = 'request' | 'history' | 'draft' | 'environment' | 'login' | 'scan';

export interface WorkspaceTab {
  id: string;
  type: WorkspaceTabType;
  title: string;
  tooltip?: string;
  collectionId?: string;
  requestId?: string;
  draftId?: string;
  selectedHistoryId?: string;
}

export interface HistoryIndexEntry {
  id: string;
  timestamp: string;
  signature: string;
  method: HttpMethod;
  path: string;
  statusCode?: number;
  durationMs: number;
  environmentId: string;
  captureResponse: boolean;
}

export interface HistorySourceContext {
  kind: 'collection' | 'draft' | 'adhoc';
  collectionId?: string;
  requestId?: string;
  draftId?: string;
}

export interface HistoryEntry {
  specVersion: string;
  id: string;
  timestamp: string;
  signature: string;
  environmentId: string;
  source: HistorySourceContext;
  request: ApiRequest;
  resolvedUrl: string;
  response?: ApiResponse;
  captureResponse: boolean;
  durationMs: number;
  error?: string;
}

export interface DraftSummary {
  id: string;
  name: string;
  method: HttpMethod;
  path: string;
  updatedAt: string;
}

export interface DraftDocument {
  specVersion: string;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceHistoryId?: string;
  method: HttpMethod;
  url: string;
  path: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  body?: string;
  requestBody?: RequestBody;
  authorization?: RequestAuthorization;
  automation?: RequestAutomation;
  ui?: RequestUi;
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

export interface ApiRequest {
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  body?: string;
  requestBody?: RequestBody;
  authorization?: RequestAuthorization;
  automation?: RequestAutomation;
  ui?: RequestUi;
}

export interface FileResponseMetadata {
  stored: boolean;
  ephemeral?: boolean;
  fileName: string;
  contentType: string;
  size: number;
  downloadPath: string;
  fileExists?: boolean;
  previewUri?: string;
}

export interface ApiResponse {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
  fileResponse?: FileResponseMetadata;
}

export interface WorkspaceTabState {
  request: ApiRequest;
  response: ApiResponse | null;
  error: string | null;
  sending: boolean;
  historyEntry: HistoryEntry | null;
  draftName?: string;
  scriptConsoleLogs?: string[];
  testResults?: ResponseTestResult[];
}

export type VsCodeMessage =
  | { type: 'ready' }
  | { type: 'webviewReady' }
  | { type: 'rescan' }
  | { type: 'rescanConfirmed' }
  | { type: 'setAutomaticScan'; enabled: boolean }
  | { type: 'openLoginTab' }
  | { type: 'openEnvironmentTab' }
  | { type: 'openHistoryTab' }
  | {
      type: 'performAuthLogin';
      method: AuthMethodId;
      environmentId: string;
      payload: AuthLoginPayload;
    }
  | { type: 'performAuthLogout'; method?: AuthMethodId }
  | { type: 'openSessionLoginModal' }
  | {
      type: 'performSessionLogin';
      loginUrl: string;
      username: string;
      password: string;
    }
  | { type: 'setActiveEnvironment'; environmentId: string }
  | { type: 'updateEnvironmentVariable'; environmentId: string; name: string; value: string }
  | { type: 'createEnvironment'; name: string; environmentType: EnvironmentTier }
  | { type: 'setEnvironmentType'; environmentId: string; environmentType: EnvironmentTier }
  | { type: 'renameEnvironment'; environmentId: string; name: string }
  | { type: 'deleteEnvironment'; environmentId: string }
  | { type: 'duplicateEnvironment'; environmentId: string }
  | { type: 'setEnvironmentVariables'; environmentId: string; variables: EnvironmentVariable[] }
  | {
      type: 'copyEnvironmentVariable';
      sourceEnvironmentId: string;
      variable: EnvironmentVariable;
      targetEnvironmentIds: string[];
      overwriteExisting: boolean;
    }
  | { type: 'clearRuntimeVariables' }
  | { type: 'deleteRuntimeVariable'; name: string }
  | { type: 'promoteRuntimeVariable'; name: string; environmentId?: string }
  | { type: 'selectCollection'; collectionId: string }
  | { type: 'createCollection'; name?: string }
  | { type: 'duplicateCollection'; collectionId: string }
  | { type: 'exportCollection'; collectionId: string }
  | { type: 'importCollection' }
  | { type: 'deleteCollection'; collectionId: string }
  | { type: 'renameCollection'; collectionId: string; name: string }
  | { type: 'updateRequest'; collectionId: string; requestId: string; patch: Partial<CollectionRequest> }
  | { type: 'duplicateRequest'; collectionId: string; requestId: string }
  | { type: 'deleteRequest'; collectionId: string; requestId: string }
  | { type: 'createFolder'; collectionId: string; parentFolderId: string | null; name: string }
  | { type: 'createRequest'; collectionId: string; parentFolderId: string | null; name?: string }
  | { type: 'renameFolder'; collectionId: string; folderId: string; name: string }
  | { type: 'deleteFolder'; collectionId: string; folderId: string }
  | {
      type: 'moveTreeNode';
      collectionId: string;
      nodeId: string;
      nodeType: 'folder' | 'request';
      targetFolderId: string | null;
      insertBeforeId?: string;
    }
  | { type: 'renameRequest'; collectionId: string; requestId: string; name: string }
  | {
      type: 'executeRequest';
      request: ApiRequest;
      lastResponse?: ApiResponse | null;
      context?: {
        kind: 'collection' | 'draft' | 'adhoc';
        collectionId?: string;
        requestId?: string;
        draftId?: string;
        captureResponse?: boolean;
        path?: string;
      };
    }
  | { type: 'loadHistoryEntry'; historyId: string }
  | { type: 'loadMoreHistoryDays'; count?: number }
  | { type: 'createDraftFromHistory'; historyId: string }
  | { type: 'loadDraft'; draftId: string }
  | { type: 'updateDraft'; draftId: string; patch: ApiRequest; name?: string }
  | { type: 'deleteDraft'; draftId: string }
  | {
      type: 'saveDraftToCollection';
      draftId: string;
      collectionId: string;
      parentFolderId: string | null;
    }
  | {
      type: 'setCaptureResponse';
      collectionId: string;
      requestId: string;
      captureResponse: boolean;
    }
  | { type: 'buildRequestForEndpoint'; requestId: string }
  | { type: 'openSource'; requestId: string }
  | { type: 'updateUiPreferences'; ui: ApiScopeUiPreferences }
  | { type: 'updateLayout'; layout: RequestResponseLayoutMode }
  | { type: 'pickUploadFile' }
  | { type: 'checkUploadFilePaths'; paths: string[] }
  | { type: 'saveDownloadFile'; downloadPath: string; fileName: string }
  | { type: 'revealDownloadFile'; downloadPath: string }
  | { type: 'clearAuth' };

export type ExtensionMessage =
  | { type: 'state'; data: ApiScopeStateJson }
  | { type: 'theme'; theme: AppTheme }
  | { type: 'error'; message: string; runtimeVariables?: EnvironmentVariable[]; scriptConsoleLogs?: string[] }
  | {
      type: 'response';
      data: ApiResponse;
      runtimeVariables?: EnvironmentVariable[];
      scriptError?: string;
      scriptConsoleLogs?: string[];
      testResults?: ResponseTestResult[];
    }
  | { type: 'request'; data: ApiRequest; requestId: string; collectionId: string; collectionType: CollectionType }
  | { type: 'selectRequest'; requestId: string }
  | {
      type: 'navigateToRequest';
      requestId: string;
      collectionId: string;
      controllerName?: string;
    }
  | { type: 'confirmRescan' }
  | { type: 'scanSummary'; data: ScanSummary }
  | { type: 'openLoginTab' }
  | { type: 'openEnvironmentTab' }
  | { type: 'openHistoryTab' }
  | { type: 'openScanTab' }
  | { type: 'openSessionLoginModal' }
  | {
      type: 'authLoginResult';
      success: boolean;
      error?: string;
      cookieNames?: string[];
    }
  | {
      type: 'sessionLoginResult';
      success: boolean;
      error?: string;
      cookieNames?: string[];
    }
  | { type: 'historyEntry'; data: HistoryEntry }
  | { type: 'historyRecorded'; entryId: string }
  | { type: 'historyDaysLoaded'; hasMore: boolean }
  | {
      type: 'uploadFilePicked';
      filePath: string;
      fileName: string;
      fileSize: number;
    }
  | {
      type: 'uploadFilePathStatus';
      results: Array<{
        filePath: string;
        exists: boolean;
        fileName: string;
        fileSize?: number;
      }>;
    }
  | { type: 'draft'; data: DraftDocument }
  | { type: 'draftDeleted'; draftId: string }
  | {
      type: 'draftSavedToCollection';
      draftId: string;
      collectionId: string;
      requestId: string;
    }
  | { type: 'variableCopied'; copiedCount: number }
  | { type: 'notification'; message: string };

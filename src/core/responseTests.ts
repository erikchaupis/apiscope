import {
  findResponseCookie,
  findResponseHeader,
  resolveJsonPath,
} from './postRequestVariables';
import {
  ApiResponse,
  ResponseTestCheck,
  ResponseTestOperator,
  ResponseTestResult,
} from './types';

function valueToString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === 'string') {
    return value.length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value as object).length === 0;
  }
  return false;
}

function compareValues(
  operator: ResponseTestOperator,
  actual: unknown,
  expected?: string
): boolean {
  switch (operator) {
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'is-empty':
      return isEmptyValue(actual);
    case 'is-not-empty':
      return !isEmptyValue(actual);
    case 'equals':
      return valueToString(actual) === (expected ?? '');
    case 'not-equals':
      return valueToString(actual) !== (expected ?? '');
    case 'contains':
      return (valueToString(actual) ?? '').includes(expected ?? '');
    case 'greater-than':
      return Number(actual) > Number(expected);
    case 'less-than':
      return Number(actual) < Number(expected);
    default:
      return false;
  }
}

function formatExpected(operator: ResponseTestOperator, expected?: string): string {
  switch (operator) {
    case 'exists':
      return 'Exists';
    case 'is-empty':
      return 'Is Empty';
    case 'is-not-empty':
      return 'Is Not Empty';
    case 'equals':
      return expected ?? '';
    case 'not-equals':
      return `≠ ${expected ?? ''}`;
    case 'contains':
      return `Contains ${expected ?? ''}`;
    case 'greater-than':
      return `> ${expected ?? ''}`;
    case 'less-than':
      return `< ${expected ?? ''}`;
    default:
      return expected ?? '';
  }
}

function responseSizeBytes(body: string): number {
  return Buffer.byteLength(body, 'utf8');
}

function resolveCheckActual(
  check: ResponseTestCheck,
  response: ApiResponse
): unknown {
  switch (check.type) {
    case 'status-code':
      return response.statusCode;
    case 'response-time':
      return response.durationMs;
    case 'response-size':
      return responseSizeBytes(response.body);
    case 'response-header':
      return findResponseHeader(response.headers, check.headerName ?? '');
    case 'response-cookie': {
      const cookieName = check.cookieName?.trim() ?? '';
      if (!cookieName) {
        return undefined;
      }
      if (check.operator === 'exists') {
        return findResponseCookie(response.headers, cookieName) !== undefined
          ? cookieName
          : undefined;
      }
      return findResponseCookie(response.headers, cookieName);
    }
    case 'json-field': {
      const path = check.jsonPath?.trim();
      if (!path) {
        return undefined;
      }
      try {
        const parsed = JSON.parse(response.body);
        return resolveJsonPath(parsed, path);
      } catch {
        return undefined;
      }
    }
    default:
      return undefined;
  }
}

function formatDisplayExpected(check: ResponseTestCheck): string {
  const operator = check.operator;
  const value = check.value ?? '';
  switch (check.type) {
    case 'response-time':
      if (operator === 'less-than') {
        return `< ${value} ms`;
      }
      if (operator === 'greater-than') {
        return `> ${value} ms`;
      }
      if (operator === 'equals') {
        return `${value} ms`;
      }
      break;
    case 'response-size':
      if (operator === 'less-than') {
        return `< ${value} bytes`;
      }
      if (operator === 'greater-than') {
        return `> ${value} bytes`;
      }
      if (operator === 'equals') {
        return `${value} bytes`;
      }
      break;
    default:
      break;
  }
  return formatExpected(operator, check.value);
}

function formatActualDisplay(check: ResponseTestCheck, actual: unknown): string | undefined {
  const text = valueToString(actual);
  if (text === undefined) {
    return undefined;
  }
  if (check.type === 'response-time') {
    return `${text} ms`;
  }
  if (check.type === 'response-size') {
    return `${text} bytes`;
  }
  return text;
}

export const SCRIPT_TEST_CHECK_ID = 'script-test';

export function evaluateResponseTest(
  check: ResponseTestCheck,
  response: ApiResponse | null | undefined
): ResponseTestResult {
  const name = responseTestCheckTitle(check);
  if (!response) {
    return {
      checkId: check.id,
      name,
      passed: false,
      expected: formatDisplayExpected(check),
    };
  }
  if (!check.enabled) {
    return { checkId: check.id, name, passed: true };
  }

  const actual = resolveCheckActual(check, response);
  const passed = compareValues(check.operator, actual, check.value);
  return {
    checkId: check.id,
    name,
    passed,
    actual: formatActualDisplay(check, actual),
    expected: formatDisplayExpected(check),
  };
}

export function evaluateResponseTests(
  checks: ResponseTestCheck[] | undefined,
  response: ApiResponse | null | undefined
): ResponseTestResult[] {
  return (checks ?? [])
    .filter((check) => check.enabled)
    .map((check) => evaluateResponseTest(check, response));
}

export function mergeTestExecutionResults(
  checks: ResponseTestCheck[] | undefined,
  response: ApiResponse | null | undefined,
  storedResults?: ResponseTestResult[]
): ResponseTestResult[] {
  const visual = evaluateResponseTests(checks, response);
  const scriptResult = storedResults?.find((result) => result.checkId === SCRIPT_TEST_CHECK_ID);
  if (scriptResult) {
    return [...visual, scriptResult];
  }
  return visual;
}

export function responseTestCheckTitle(check: ResponseTestCheck): string {
  switch (check.type) {
    case 'status-code':
      return 'Status Code';
    case 'response-time':
      return 'Response Time';
    case 'response-size':
      return 'Response Size';
    case 'response-header':
      return `Header: ${check.headerName?.trim() || 'Header'}`;
    case 'response-cookie':
      return `Cookie: ${check.cookieName?.trim() || 'Cookie'}`;
    case 'json-field':
      return check.jsonPath?.trim() || 'JSON Field';
    default:
      return 'Check';
  }
}

const OPERATOR_LABELS: Record<ResponseTestOperator, string> = {
  exists: 'Exists',
  equals: 'Equals',
  'not-equals': 'Not Equals',
  contains: 'Contains',
  'greater-than': 'Greater Than',
  'less-than': 'Less Than',
  'is-empty': 'Is Empty',
  'is-not-empty': 'Is Not Empty',
};

export function responseTestOperatorLabel(operator: ResponseTestOperator): string {
  return OPERATOR_LABELS[operator];
}

export function responseTestCheckSummary(check: ResponseTestCheck): string {
  const operator = responseTestOperatorLabel(check.operator);
  switch (check.type) {
    case 'status-code':
      if (check.operator === 'exists' || check.operator === 'is-empty' || check.operator === 'is-not-empty') {
        return operator;
      }
      return `${operator} ${check.value ?? ''}`.trim();
    case 'response-size':
      if (check.operator === 'exists' || check.operator === 'is-empty' || check.operator === 'is-not-empty') {
        return operator;
      }
      return `${operator} ${check.value ?? ''} bytes`.trim();
    case 'response-time':
      if (check.operator === 'exists' || check.operator === 'is-empty' || check.operator === 'is-not-empty') {
        return operator;
      }
      return `${operator} ${check.value ?? ''} ms`.trim();
    case 'response-header':
    case 'response-cookie':
    case 'json-field':
      if (
        check.operator === 'exists' ||
        check.operator === 'is-empty' ||
        check.operator === 'is-not-empty'
      ) {
        return operator;
      }
      if (check.operator === 'contains') {
        return `${operator} ${check.value ?? ''}`.trim();
      }
      return `${operator} ${check.value ?? ''}`.trim();
    default:
      return operator;
  }
}

export function createResponseTestCheckId(): string {
  return `test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const RESPONSE_TEST_OPERATORS: ResponseTestOperator[] = [
  'exists',
  'equals',
  'not-equals',
  'contains',
  'greater-than',
  'less-than',
  'is-empty',
  'is-not-empty',
];

export const OPERATORS_BY_CHECK_TYPE: Record<
  ResponseTestCheck['type'],
  ResponseTestOperator[]
> = {
  'status-code': ['equals', 'not-equals', 'greater-than', 'less-than'],
  'response-time': ['less-than', 'greater-than', 'equals'],
  'response-size': ['greater-than', 'less-than', 'equals'],
  'response-header': [
    'equals',
    'not-equals',
    'contains',
    'exists',
    'is-empty',
    'is-not-empty',
  ],
  'response-cookie': [
    'exists',
    'equals',
    'not-equals',
    'contains',
    'is-empty',
    'is-not-empty',
  ],
  'json-field': RESPONSE_TEST_OPERATORS,
};

export const DEFAULT_OPERATOR_BY_CHECK_TYPE: Record<
  ResponseTestCheck['type'],
  ResponseTestOperator
> = {
  'status-code': 'equals',
  'response-time': 'less-than',
  'response-size': 'greater-than',
  'response-header': 'equals',
  'response-cookie': 'exists',
  'json-field': 'exists',
};

export const DEFAULT_VALUE_BY_CHECK_TYPE: Partial<Record<ResponseTestCheck['type'], string>> = {
  'status-code': '200',
  'response-time': '1000',
  'response-size': '100',
};

export function createDefaultResponseTestCheck(
  type: ResponseTestCheck['type']
): ResponseTestCheck {
  return {
    id: createResponseTestCheckId(),
    type,
    enabled: true,
    operator: DEFAULT_OPERATOR_BY_CHECK_TYPE[type],
    value: DEFAULT_VALUE_BY_CHECK_TYPE[type],
  };
}

export function operatorNeedsValue(operator: ResponseTestOperator): boolean {
  return !['exists', 'is-empty', 'is-not-empty'].includes(operator);
}

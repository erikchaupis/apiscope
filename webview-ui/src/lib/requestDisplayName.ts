import type { CollectionRequest, HttpMethod } from '../types';

export interface RequestDisplayNameInput {
  displayName?: string;
  name?: string;
  summary?: string;
  operationId?: string;
  method: HttpMethod | string;
  path: string;
}

export function operationIdToDisplayName(operationId: string): string {
  return operationId
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function humanizeSegment(segment: string): string {
  return segment
    .replace(/^\{([^}]+)\}$/, '$1')
    .replace(/^:/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function singularize(word: string): string {
  const lower = word.toLowerCase();
  if (lower.endsWith('ies')) {
    return humanizeSegment(lower.slice(0, -3) + 'y');
  }
  if (lower.endsWith('s') && !lower.endsWith('ss')) {
    return humanizeSegment(lower.slice(0, -1));
  }
  return humanizeSegment(lower);
}

function isParamSegment(segment: string): boolean {
  return /^\{[^}]+\}$/.test(segment) || /^:[A-Za-z_]\w*$/.test(segment);
}

function paramLabel(segment: string): string {
  const match = segment.match(/^\{([^}]+)\}$/) ?? segment.match(/^:(.+)$/);
  const raw = match?.[1] ?? 'Id';
  const cleaned = raw.replace(/[-_]+/g, ' ').replace(/Id$/i, '').trim() || raw;
  return humanizeSegment(cleaned);
}

export function generateDisplayNameFromPath(method: HttpMethod | string, path: string): string {
  const normalized = path.split('?')[0]?.trim() || '/';
  const segments = normalized.split('/').filter(Boolean);

  if (segments.length === 0) {
    return 'Root';
  }

  const staticSegments = segments.filter((segment) => !isParamSegment(segment));
  const paramSegment = segments.find((segment) => isParamSegment(segment));

  if (paramSegment && staticSegments.length > 0) {
    const resource = singularize(staticSegments[staticSegments.length - 1]);
    const byParam = paramLabel(paramSegment);
    switch (method) {
      case 'GET':
        return `Get ${resource} By ${byParam}`;
      case 'POST':
        return `Create ${resource} By ${byParam}`;
      case 'PUT':
      case 'PATCH':
        return `Update ${resource} By ${byParam}`;
      case 'DELETE':
        return `Delete ${resource} By ${byParam}`;
      default:
        return `${resource} By ${byParam}`;
    }
  }

  const last = staticSegments[staticSegments.length - 1] ?? segments[segments.length - 1];
  return humanizeSegment(last);
}

export function resolveRequestDisplayName(input: RequestDisplayNameInput): string {
  if (input.displayName?.trim()) {
    return input.displayName.trim();
  }
  if (input.summary?.trim()) {
    return input.summary.trim();
  }
  if (input.operationId?.trim()) {
    return operationIdToDisplayName(input.operationId.trim());
  }
  const legacyName = input.name?.trim();
  const legacyPathLabel = `${input.method} ${input.path}`;
  if (legacyName && legacyName !== legacyPathLabel) {
    return legacyName;
  }
  return generateDisplayNameFromPath(input.method, input.path);
}

export function resolveCollectionRequestDisplayName(request: CollectionRequest): string {
  return resolveRequestDisplayName({
    displayName: request.displayName,
    name: request.name,
    method: request.method,
    path: request.path,
  });
}

export function requestPathSubtitle(method: HttpMethod | string, path: string): string {
  return `${method} ${path}`;
}

export function requestTabTitle(method: HttpMethod | string, request: CollectionRequest): string {
  return `${method} ${resolveCollectionRequestDisplayName(request)}`;
}

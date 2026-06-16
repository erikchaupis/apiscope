import * as fs from 'fs';
import type { Endpoint } from '../../core/types';
import type { RequestBody } from '../../core/requestBody';
import { createEmptyMultipartField } from '../../core/requestBody';
import {
  exampleValueForType,
  formatJsonBody,
  readSliceAroundLine,
  type ModelField,
} from './shared';

export interface ExpressRequestBodyResult {
  body?: string;
  requestBody?: RequestBody;
}

interface MulterBinding {
  varName: string;
  field: string;
  multiple: boolean;
}

export function buildExpressRequestBody(endpoint: Endpoint): ExpressRequestBodyResult | undefined {
  let content: string;
  try {
    content = fs.readFileSync(endpoint.filePath, 'utf-8');
  } catch {
    return undefined;
  }

  const slice = endpoint.line ? readSliceAroundLine(content, endpoint.line, 0, 40) : content;
  const multipart = detectMultipartBody(content, slice);
  if (multipart) {
    return {
      requestBody: {
        kind: 'multipart',
        formData: [
          {
            key: multipart.field,
            type: 'file',
            filePath: '',
            enabled: true,
          },
        ],
      },
    };
  }

  const jsonFields = extractJsonBodyFields(slice);
  if (jsonFields.length) {
    const body: Record<string, unknown> = {};
    for (const field of jsonFields) {
      body[field.name] = exampleValueForType(field.type, field.name);
    }
    const json = formatJsonBody(body);
    return {
      body: json,
      requestBody: { kind: 'json', content: json },
    };
  }

  if (usesExpressJson(content) && slice.includes('req.body')) {
    const json = formatJsonBody({});
    return {
      body: json,
      requestBody: { kind: 'json', content: json },
    };
  }

  return undefined;
}

function usesExpressJson(content: string): boolean {
  return /\bexpress\.json\s*\(/.test(content) || /\bapp\.use\s*\(\s*express\.json/.test(content);
}

function detectMultipartBody(
  fileContent: string,
  routeSlice: string
): { field: string; multiple: boolean } | undefined {
  const bindings = extractMulterBindings(fileContent);

  for (const binding of bindings) {
    const callPattern = new RegExp(`\\b${binding.varName}\\s*\\(`);
    if (callPattern.test(routeSlice)) {
      return { field: binding.field, multiple: binding.multiple };
    }
  }

  const inlineSingle = routeSlice.match(/\.single\(\s*['"](\w+)['"]\s*\)/);
  if (inlineSingle) {
    return { field: inlineSingle[1], multiple: false };
  }

  const inlineArray = routeSlice.match(/\.array\(\s*['"](\w+)['"]/);
  if (inlineArray) {
    return { field: inlineArray[1], multiple: true };
  }

  if (/req\.files?\b/.test(routeSlice)) {
    const fallback = bindings[0];
    if (fallback) {
      return { field: fallback.field, multiple: fallback.multiple };
    }
  }

  return undefined;
}

function extractMulterBindings(content: string): MulterBinding[] {
  const bindings: MulterBinding[] = [];
  const regex =
    /(\w+)\s*=\s*multer\s*\([^;]*\)\s*\.(single|array)\(\s*['"](\w+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    bindings.push({
      varName: match[1],
      field: match[3],
      multiple: match[2] === 'array',
    });
  }
  return bindings;
}

function extractJsonBodyFields(slice: string): ModelField[] {
  const destructuring = slice.match(/(?:const|let|var)\s*\{([^}]+)\}\s*=\s*req\.body\b/);
  if (destructuring) {
    return destructuring[1]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const alias = part.split(':').map((piece) => piece.trim());
        return { name: alias[0], type: 'string' };
      });
  }

  const memberAccess = [...slice.matchAll(/req\.body\.(\w+)/g)].map((match) => ({
    name: match[1],
    type: 'string',
  }));

  if (memberAccess.length) {
    const seen = new Set<string>();
    return memberAccess.filter((field) => {
      if (seen.has(field.name)) {
        return false;
      }
      seen.add(field.name);
      return true;
    });
  }

  return [];
}

export function createMultipartPlaceholder(fieldName: string): RequestBody {
  return {
    kind: 'multipart',
    formData: [{ ...createEmptyMultipartField('file'), key: fieldName, enabled: true }],
  };
}

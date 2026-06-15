import * as path from 'path';

export interface FileResponseMetadata {
  stored: boolean;
  /** When false, file lives under `.apiscope/downloads/.temp/` and is not linked from history. */
  ephemeral?: boolean;
  fileName: string;
  contentType: string;
  size: number;
  /** Path relative to workspace root, e.g. `.apiscope/downloads/2026/06/08/download-001.pdf` */
  downloadPath: string;
}

const BINARY_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/octet-stream',
  'application/zip',
  'application/x-zip-compressed',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const TEXT_CONTENT_TYPES = new Set(['application/json', 'application/xml']);

export function getHeaderValue(
  headers: Record<string, string>,
  name: string
): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value;
    }
  }
  return undefined;
}

export function normalizeMimeType(contentType: string | undefined): string | undefined {
  if (!contentType?.trim()) {
    return undefined;
  }
  return contentType.split(';')[0]?.trim().toLowerCase();
}

export function isTextContentType(contentType: string | undefined): boolean {
  const mime = normalizeMimeType(contentType);
  if (!mime) {
    return false;
  }
  if (TEXT_CONTENT_TYPES.has(mime)) {
    return true;
  }
  return mime.startsWith('text/');
}

export function isBinaryContentType(contentType: string | undefined): boolean {
  const mime = normalizeMimeType(contentType);
  if (!mime) {
    return false;
  }
  return BINARY_CONTENT_TYPES.has(mime);
}

export function isImageContentType(contentType: string | undefined): boolean {
  const mime = normalizeMimeType(contentType);
  if (!mime) {
    return false;
  }
  return mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/webp' || mime === 'image/gif';
}

export function hasAttachmentDisposition(headers: Record<string, string>): boolean {
  const value = getHeaderValue(headers, 'content-disposition');
  if (!value) {
    return false;
  }
  return /attachment/i.test(value);
}

export function isBinaryResponse(headers: Record<string, string>): boolean {
  const contentType = getHeaderValue(headers, 'content-type');
  if (isBinaryContentType(contentType)) {
    return true;
  }
  if (hasAttachmentDisposition(headers) && !isTextContentType(contentType)) {
    return true;
  }
  return false;
}

export function parseContentDispositionFilename(
  contentDisposition: string | undefined
): string | undefined {
  if (!contentDisposition) {
    return undefined;
  }

  const starMatch = contentDisposition.match(/filename\*\s*=\s*([^;]+)/i);
  if (starMatch) {
    const raw = starMatch[1].trim().replace(/^UTF-8''/i, '').replace(/^"(.*)"$/, '$1');
    try {
      return path.basename(decodeURIComponent(raw));
    } catch {
      return path.basename(raw);
    }
  }

  const match = contentDisposition.match(/filename\s*=\s*("([^"]+)"|([^;\s]+))/i);
  if (match) {
    const name = (match[2] ?? match[3] ?? '').trim();
    if (name) {
      return path.basename(name);
    }
  }

  return undefined;
}

export function fileNameFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const base = path.basename(parsed.pathname);
    if (base && base !== '/' && base !== '.') {
      return base;
    }
  } catch {
    const withoutQuery = url.split('?')[0] ?? url;
    const base = path.basename(withoutQuery);
    if (base && base !== '/' && base !== '.') {
      return base;
    }
  }
  return undefined;
}

export function extensionForContentType(contentType: string | undefined): string {
  const mime = normalizeMimeType(contentType);
  switch (mime) {
    case 'application/pdf':
      return '.pdf';
    case 'application/zip':
    case 'application/x-zip-compressed':
      return '.zip';
    case 'image/png':
      return '.png';
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'application/vnd.ms-excel':
      return '.xls';
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return '.xlsx';
    case 'application/msword':
      return '.doc';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return '.docx';
    case 'application/octet-stream':
      return '.bin';
    default:
      return '.bin';
  }
}

export function resolveDownloadFileName(
  headers: Record<string, string>,
  requestUrl: string
): string {
  const fromDisposition = parseContentDispositionFilename(
    getHeaderValue(headers, 'content-disposition')
  );
  if (fromDisposition) {
    return fromDisposition;
  }

  const fromUrl = fileNameFromUrl(requestUrl);
  if (fromUrl) {
    return fromUrl;
  }

  const contentType = getHeaderValue(headers, 'content-type');
  const ext = extensionForContentType(contentType);
  return `download${ext}`;
}

export function ensureFileExtension(fileName: string, contentType: string | undefined): string {
  const ext = path.extname(fileName);
  if (ext) {
    return fileName;
  }
  return `${fileName}${extensionForContentType(contentType)}`;
}

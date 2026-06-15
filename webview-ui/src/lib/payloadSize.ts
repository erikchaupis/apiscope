/** Byte length of a UTF-8 string (response body size). */
export function payloadByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Human-readable payload size with at most one decimal place (B / KB / MB). */
export function formatPayloadSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    const rounded = Math.round(kb * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

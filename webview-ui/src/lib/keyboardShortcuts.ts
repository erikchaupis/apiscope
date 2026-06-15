export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

/** Human-readable label for the Send shortcut (e.g. ⌘↵ or Ctrl+Enter). */
export function formatSendShortcut(): string {
  return isMacPlatform() ? '⌘↵' : 'Ctrl+Enter';
}

export function isSendShortcut(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>): boolean {
  if (event.key !== 'Enter') {
    return false;
  }
  if (event.shiftKey || event.altKey) {
    return false;
  }
  return isMacPlatform() ? event.metaKey : event.ctrlKey;
}

export function isModalOverlayVisible(): boolean {
  return document.querySelector('.fixed.inset-0') !== null;
}

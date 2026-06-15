import { useEffect } from 'react';
import { isModalOverlayVisible, isSendShortcut } from '../lib/keyboardShortcuts';

interface UseSendRequestShortcutOptions {
  enabled: boolean;
  onSend: () => void;
}

export function useSendRequestShortcut({ enabled, onSend }: UseSendRequestShortcutOptions): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isSendShortcut(event)) {
        return;
      }
      if (isModalOverlayVisible()) {
        return;
      }
      event.preventDefault();
      onSend();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onSend]);
}

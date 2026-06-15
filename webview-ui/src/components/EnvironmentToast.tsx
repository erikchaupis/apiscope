import { useEffect } from 'react';
import { Check } from 'lucide-react';

interface EnvironmentToastProps {
  message: string;
  onDismiss: () => void;
}

export function EnvironmentToast({ message, onDismiss }: EnvironmentToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timer);
  }, [onDismiss, message]);

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-border bg-card shadow-lg p-3 text-sm">
      <div className="flex items-start gap-2">
        <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
        <div className="min-w-0 text-sm">{message}</div>
      </div>
    </div>
  );
}

export function variableCopiedMessage(copiedCount: number): string {
  if (copiedCount <= 0) {
    return 'No environments were updated';
  }
  if (copiedCount === 1) {
    return 'Variable copied to 1 environment';
  }
  return `Variable copied to ${copiedCount} environments`;
}

import { Braces, ScrollText } from 'lucide-react';
import { cn } from '../lib/utils';

export type ResponseViewFormat = 'pretty' | 'raw';

interface ResponseViewFormatToggleProps {
  value: ResponseViewFormat;
  onChange: (value: ResponseViewFormat) => void;
  disablePretty?: boolean;
}

export function ResponseViewFormatToggle({
  value,
  onChange,
  disablePretty = false,
}: ResponseViewFormatToggleProps) {
  return (
    <div
      className="inline-flex rounded-md border border-border overflow-hidden shrink-0 bg-background"
      role="group"
      aria-label="View format"
    >
      <button
        type="button"
        disabled={disablePretty}
        aria-pressed={value === 'pretty'}
        onClick={() => onChange('pretty')}
        className={cn(
          'response-format-toggle-btn flex items-center gap-1.5 px-2.5 py-1 text-xs border-r border-border transition-colors',
          value === 'pretty' && 'response-format-toggle-btn-active',
          disablePretty && 'opacity-40 cursor-not-allowed'
        )}
      >
        <Braces className="w-3.5 h-3.5 shrink-0" aria-hidden />
        Pretty
      </button>
      <button
        type="button"
        aria-pressed={value === 'raw'}
        onClick={() => onChange('raw')}
        className={cn(
          'response-format-toggle-btn flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors',
          value === 'raw' && 'response-format-toggle-btn-active'
        )}
      >
        <ScrollText className="w-3.5 h-3.5 shrink-0" aria-hidden />
        Raw
      </button>
    </div>
  );
}

import { formatPayloadSize } from '../lib/payloadSize';
import { statusCodeClass, statusIndicatorClass } from '../lib/httpStatus';
import { cn } from '../lib/utils';

interface ResponseSummaryBarProps {
  statusCode: number;
  statusText: string;
  durationMs: number;
  /** Response body size in bytes. Omit to hide the size metric. */
  responseSizeBytes?: number;
  className?: string;
}

export function ResponseSummaryBar({
  statusCode,
  statusText,
  durationMs,
  responseSizeBytes,
  className,
}: ResponseSummaryBarProps) {
  return (
    <div className={cn('flex items-center gap-3 flex-wrap', className)}>
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn('w-2 h-2 rounded-full shrink-0', statusIndicatorClass(statusCode))}
          aria-hidden
        />
        <span className={cn('font-semibold truncate', statusCodeClass(statusCode))}>
          {statusCode} {statusText}
        </span>
      </div>
      <span className="text-muted-foreground text-xs shrink-0">{durationMs} ms</span>
      {responseSizeBytes !== undefined && (
        <span className="text-muted-foreground text-xs shrink-0">
          {formatPayloadSize(responseSizeBytes)}
        </span>
      )}
    </div>
  );
}

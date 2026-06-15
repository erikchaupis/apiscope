import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { LastScanRecord } from '../types';
import { cn } from '../lib/utils';

interface ScanTabViewProps {
  lastScan?: LastScanRecord;
  frameworkLabel?: string;
  automaticScan: boolean;
  onAutomaticScanChange: (enabled: boolean) => void;
  onScanNow: () => void;
}

export function ScanTabView({
  lastScan,
  frameworkLabel,
  automaticScan,
  onAutomaticScanChange,
  onScanNow,
}: ScanTabViewProps) {
  const frameworkDisplay = formatFramework(lastScan?.framework, frameworkLabel);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-auto p-4">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div>
          <h2 className="text-sm font-semibold">Scan</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Overview of the last project scan. Open the generated collection to explore endpoints.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={automaticScan}
              onChange={(e) => onAutomaticScanChange(e.target.checked)}
              className="rounded border-border"
            />
            <span>Automatic Scan</span>
          </label>
          <button
            type="button"
            onClick={onScanNow}
            className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent inline-flex items-center gap-1.5 font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Scan Now
          </button>
        </div>

        {!lastScan ? (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            No scan has been recorded yet. Run a scan to discover endpoints from your project source.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Framework" value={frameworkDisplay} />
              <StatCard label="Controllers" value={String(lastScan.controllers)} />
              <StatCard label="Endpoints" value={String(lastScan.endpoints)} />
              <StatCard label="Last Scan" value={formatLastScan(lastScan.lastScan)} />
            </div>

            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              <ChangeRow
                label="Added"
                count={lastScan.added}
                labels={lastScan.addedLabels}
                tone="success"
              />
              <ChangeRow
                label="Updated"
                count={lastScan.updated}
                labels={lastScan.updatedLabels}
                tone="warning"
              />
              <ChangeRow
                label="Removed"
                count={lastScan.removed}
                labels={lastScan.removedLabels}
                tone="danger"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-1 truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

function ChangeRow({
  label,
  count,
  labels,
  tone,
}: {
  label: string;
  count: number;
  labels: string[];
  tone: 'success' | 'warning' | 'danger';
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = labels.length > 0;
  const toneClass =
    tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-danger';

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        {hasDetails ? (
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            className="flex items-center gap-2 text-sm hover:text-foreground text-left min-w-0 flex-1"
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="font-medium">{label}</span>
            <span className={cn('font-mono text-xs', toneClass)}>{count}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 text-sm flex-1">
            <span className="w-3.5 shrink-0" />
            <span className="font-medium">{label}</span>
            <span className={cn('font-mono text-xs', toneClass)}>{count}</span>
          </div>
        )}
      </div>
      {hasDetails && expanded && (
        <ul className="mt-2 ml-5 space-y-0.5 text-xs font-mono text-muted-foreground max-h-48 overflow-auto">
          {labels.map((item) => (
            <li key={item} className="truncate" title={item}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatFramework(framework?: string, frameworkLabel?: string): string {
  if (frameworkLabel?.trim()) {
    return frameworkLabel.trim();
  }
  if (!framework?.trim()) {
    return '—';
  }
  return framework.charAt(0).toUpperCase() + framework.slice(1);
}

function formatLastScan(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

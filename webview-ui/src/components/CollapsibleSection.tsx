import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

interface CollapsibleSectionProps {
  id: string;
  title: string;
  expanded: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
  className?: string;
}

export function CollapsibleSection({
  id,
  title,
  expanded,
  onToggle,
  children,
  className,
}: CollapsibleSectionProps) {
  const panelId = `section-panel-${id}`;
  const headerId = `section-header-${id}`;

  return (
    <section className={cn('border border-border rounded-md bg-card overflow-hidden shrink-0', className)}>
      <button
        type="button"
        id={headerId}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => onToggle(id)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <ChevronRight
          className={cn(
            'w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            expanded && 'rotate-90'
          )}
          aria-hidden
        />
        <span>{title}</span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden min-h-0 min-w-0">
          <div className="px-3 pb-3 pt-0 border-t border-border">{children}</div>
        </div>
      </div>
    </section>
  );
}

interface InspectorGroupProps {
  title: string;
  children: ReactNode;
}

export function InspectorGroup({ title, children }: InspectorGroupProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

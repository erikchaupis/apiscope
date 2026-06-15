import type { ReactNode } from 'react';
import type { RequestResponseLayoutMode } from '../types';
import { cn } from '../lib/utils';

export interface LayoutPanel {
  id: string;
  content: ReactNode;
}

interface RequestResponseLayoutProps {
  layout: RequestResponseLayoutMode;
  panels: LayoutPanel[];
}

export function RequestResponseLayout({ layout, panels }: RequestResponseLayoutProps) {
  const isVertical = layout === 'vertical';

  return (
    <div
      className={cn(
        'flex flex-1 min-h-0 min-w-0 transition-[flex-direction] duration-200 ease-in-out',
        isVertical ? 'flex-row' : 'flex-col'
      )}
    >
      {panels.map((panel, index) => (
        <div
          key={panel.id}
          className={cn(
            'flex flex-col min-h-0 min-w-0 flex-1 overflow-hidden',
            index < panels.length - 1 &&
              (isVertical ? 'border-r border-border' : 'border-b border-border')
          )}
        >
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">{panel.content}</div>
        </div>
      ))}
    </div>
  );
}

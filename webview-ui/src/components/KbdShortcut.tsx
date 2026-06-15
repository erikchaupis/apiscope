import { cn } from '../lib/utils';

interface KbdShortcutProps {
  children: string;
  className?: string;
}

export function KbdShortcut({ children, className }: KbdShortcutProps) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground',
        className
      )}
    >
      {children}
    </kbd>
  );
}

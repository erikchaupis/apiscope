import { cn } from '../lib/utils';

export type RequestEditorPanel =
  | 'request'
  | 'authentication'
  | 'variables'
  | 'scripts'
  | 'tests';

export type VariablesSubTab = 'pre' | 'post';
export type ScriptsSubTab = 'pre' | 'post';

interface TabOption<T extends string> {
  id: T;
  label: string;
}

interface EditorTabBarProps<T extends string> {
  tabs: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  variant?: 'primary' | 'secondary';
}

export function EditorTabBar<T extends string>({
  tabs,
  value,
  onChange,
  className,
  variant = 'primary',
}: EditorTabBarProps<T>) {
  const isPrimary = variant === 'primary';

  return (
    <div
      className={cn(
        'flex gap-0 shrink-0',
        isPrimary ? 'px-2 bg-card border-t border-border' : 'px-3 border-b border-border bg-muted/30',
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'text-xs transition-colors border-b-2 -mb-px',
            isPrimary ? 'px-3 py-1.5' : 'px-2.5 py-1.5',
            value === tab.id
              ? isPrimary
                ? 'editor-tab-active text-foreground'
                : 'editor-tab-active-secondary text-foreground'
              : 'border-transparent text-muted-foreground/75 hover:text-foreground'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

const PRIMARY_TABS: TabOption<RequestEditorPanel>[] = [
  { id: 'request', label: 'Request' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'variables', label: 'Variables' },
  { id: 'scripts', label: 'Scripts' },
  { id: 'tests', label: 'Tests' },
];

export function RequestEditorTabBar({
  value,
  onChange,
  className,
}: {
  value: RequestEditorPanel;
  onChange: (panel: RequestEditorPanel) => void;
  className?: string;
}) {
  return (
    <EditorTabBar
      tabs={PRIMARY_TABS}
      value={value}
      onChange={onChange}
      className={className}
      variant="primary"
    />
  );
}

const VARIABLES_SUB_TABS: TabOption<VariablesSubTab>[] = [
  { id: 'pre', label: 'Pre' },
  { id: 'post', label: 'Post' },
];

export function VariablesSubTabBar({
  value,
  onChange,
}: {
  value: VariablesSubTab;
  onChange: (tab: VariablesSubTab) => void;
}) {
  return (
    <EditorTabBar tabs={VARIABLES_SUB_TABS} value={value} onChange={onChange} variant="secondary" />
  );
}

const SCRIPTS_SUB_TABS: TabOption<ScriptsSubTab>[] = [
  { id: 'pre', label: 'Pre' },
  { id: 'post', label: 'Post' },
];

export function ScriptsSubTabBar({
  value,
  onChange,
}: {
  value: ScriptsSubTab;
  onChange: (tab: ScriptsSubTab) => void;
}) {
  return (
    <EditorTabBar tabs={SCRIPTS_SUB_TABS} value={value} onChange={onChange} variant="secondary" />
  );
}

/** @deprecated Use VariablesSubTab or ScriptsSubTab */
export type AutomationSubTab = 'pre-request' | 'post-request' | 'tests';

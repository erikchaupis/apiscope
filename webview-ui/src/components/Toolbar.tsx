import { Clock, RefreshCw, ScanLine, Settings2 } from 'lucide-react';
import type { AppTheme, AuthStatus, Environment, ProjectInfo } from '../types';
import { AuthStatusChip } from './AuthStatusChip';
import { BrandLogo } from './BrandLogo';
import { EnvironmentSelector } from './EnvironmentSelector';
import { ThemeSelector } from './ThemeSelector';
import { projectDetectedTooltip } from '../lib/projectLabel';

interface ToolbarProps {
  project: ProjectInfo;
  authStatus: AuthStatus;
  showGeneratedHint?: boolean;
  environments: Environment[];
  activeEnvironmentId: string;
  onSelectEnvironment: (id: string) => void;
  onOpenEnvironments: () => void;
  onOpenGlobalAuthentication: () => void;
  onOpenHistory: () => void;
  onOpenScan: () => void;
  onRescan: () => void;
  theme: AppTheme;
  onSelectTheme: (theme: AppTheme) => void;
}

export function Toolbar({
  project,
  authStatus,
  showGeneratedHint = false,
  environments,
  activeEnvironmentId,
  onSelectEnvironment,
  onOpenEnvironments,
  onOpenGlobalAuthentication,
  onOpenHistory,
  onOpenScan,
  onRescan,
  theme,
  onSelectTheme,
}: ToolbarProps) {
  return (
    <header className="app-toolbar flex items-center gap-2.5 px-3 py-2.5 border-b border-border shrink-0 relative z-20">
      <BrandLogo size={26} className="shrink-0" />
      <span className="font-semibold text-sm shrink-0 tracking-tight">
        <span className="brand-wordmark-api">API</span>
        <span className="brand-wordmark-scope">Scope</span>
      </span>
      {project.label && (
        <span
          className="text-xs text-muted-foreground truncate hidden sm:inline max-w-[160px]"
          title={project.detected ? projectDetectedTooltip(project.label) : project.label}
        >
          {project.label}
        </span>
      )}
      {showGeneratedHint && (
        <span
          className="text-xs truncate hidden md:inline"
          style={{ color: 'var(--as-brand-orange)' }}
          title="Generated collections reset on rescan"
        >
          Reset on rescan
        </span>
      )}
      <div className="flex-1 min-w-2" />

      <div className="flex items-stretch rounded border border-border shrink-0 max-w-[280px]">
        <EnvironmentSelector
          environments={environments}
          activeEnvironmentId={activeEnvironmentId}
          onSelectEnvironment={onSelectEnvironment}
          variant="segment-left"
        />
        <button
          type="button"
          onClick={onOpenEnvironments}
          className="toolbar-btn-environment flex items-center justify-center px-2 py-1 border-l border-border shrink-0 rounded-r"
          title="Configure environments"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <AuthStatusChip authStatus={authStatus} onClick={onOpenGlobalAuthentication} />

      <button
        type="button"
        onClick={onOpenHistory}
        className="toolbar-btn-history flex items-center gap-1 text-xs px-2 py-1 rounded shrink-0 font-medium"
        title="Open History"
      >
        <Clock className="w-3.5 h-3.5" />
        History
      </button>

      <button
        type="button"
        onClick={onOpenScan}
        className="toolbar-btn-scan flex items-center gap-1 text-xs px-2 py-1 rounded shrink-0 font-medium"
        title="Open Scan dashboard"
      >
        <ScanLine className="w-3.5 h-3.5" />
        Scan
      </button>

      <button
        type="button"
        onClick={onRescan}
        className="p-1.5 rounded border border-border hover:bg-accent text-muted-foreground hover:text-foreground shrink-0"
        title="Rescan Project"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>

      <ThemeSelector theme={theme} onSelectTheme={onSelectTheme} />
    </header>
  );
}

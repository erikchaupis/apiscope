import { Environment } from '../core/types';
import { EnvironmentManager } from '../environment/EnvironmentManager';
import { AuthStorage } from './AuthStorage';
import { performServerLogout } from './SessionLogout';

export function resolveLogoutUrl(envManager: EnvironmentManager, env: Environment): string {
  const custom = env.variables.find((v) => v.name === 'logoutUrl')?.value?.trim();
  if (custom) {
    return envManager.resolveUrl(custom, env);
  }
  const baseUrl = env.variables.find((v) => v.name === 'baseUrl')?.value?.trim() ?? 'http://localhost:8080';
  return `${baseUrl.replace(/\/$/, '')}/logout`;
}

function resolveCsrfProbeUrl(envManager: EnvironmentManager, env: Environment): string {
  const custom = env.variables.find((v) => v.name === 'logoutCsrfProbeUrl')?.value?.trim();
  if (custom) {
    return envManager.resolveUrl(custom, env);
  }
  const baseUrl = env.variables.find((v) => v.name === 'baseUrl')?.value?.trim() ?? 'http://localhost:8080';
  return `${baseUrl.replace(/\/$/, '')}/tickets`;
}

export async function executeSessionLogout(
  authStorage: AuthStorage,
  envManager: EnvironmentManager,
  workspaceRoot: string
): Promise<void> {
  const auth = await authStorage.load();
  const envs = await envManager.getEnvironments(workspaceRoot);
  const activeId = await envManager.getActiveEnvironmentId(workspaceRoot);
  const env = envs.find((item) => item.id === activeId) ?? envs[0];

  if (auth?.cookies.length && env) {
    try {
      await performServerLogout(
        resolveLogoutUrl(envManager, env),
        auth.cookies,
        resolveCsrfProbeUrl(envManager, env)
      );
    } catch {
      // always clear local session even if server logout fails
    }
  }

  await authStorage.clear();
}

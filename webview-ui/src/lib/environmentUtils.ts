import type { Environment, EnvironmentTier, EnvironmentVariable } from '../types';

export const SENSITIVE_MASK = '********';

const TIER_LABELS: Record<EnvironmentTier, string> = {
  LOCAL: 'Local',
  DEV: 'Development',
  UAT: 'UAT',
  STAGING: 'Staging',
  PROD: 'Production',
  CUSTOM: 'Custom',
};

export function environmentTierLabel(tier: EnvironmentTier): string {
  return TIER_LABELS[tier];
}

export function environmentTierBadgeClass(tier: EnvironmentTier): string {
  switch (tier) {
    case 'LOCAL':
      return 'env-tier-local';
    case 'DEV':
      return 'env-tier-dev';
    case 'UAT':
      return 'env-tier-uat';
    case 'STAGING':
      return 'env-tier-staging';
    case 'PROD':
      return 'env-tier-prod';
    case 'CUSTOM':
      return 'env-tier-custom';
  }
}

export function hasSensitiveVariables(environment: Environment): boolean {
  return environment.variables.some((v) => v.sensitive);
}

export function displayVariableValue(
  variable: EnvironmentVariable,
  showSensitiveValues: boolean,
  isFocused: boolean
): string {
  if (variable.sensitive && !showSensitiveValues && !isFocused) {
    return SENSITIVE_MASK;
  }
  return variable.value;
}

/** Stable order: generated first, then alphabetical by name. Does not reorder on selection. */
export function sortEnvironmentsForList(environments: Environment[]): Environment[] {
  return [...environments].sort((a, b) => {
    if (a.source === 'generated') {
      return -1;
    }
    if (b.source === 'generated') {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
}

export function environmentListLabel(environment: Environment): string {
  const shield = hasSensitiveVariables(environment) ? ' 🛡' : '';
  return `${environment.name}${shield}`;
}

export function environmentHeaderLabel(environment: Environment): string {
  const shield = hasSensitiveVariables(environment) ? ' 🛡' : '';
  if (environment.source === 'generated') {
    return `${environment.name}${shield} (Generated)`;
  }
  return `${environment.name}${shield}`;
}

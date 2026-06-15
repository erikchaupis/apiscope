import { cn } from '../lib/utils';
import { environmentTierBadgeClass } from '../lib/environmentUtils';
import type { EnvironmentTier } from '../types';

interface EnvironmentTierBadgeProps {
  tier: EnvironmentTier;
  className?: string;
  title?: string;
}

export function EnvironmentTierBadge({ tier, className, title }: EnvironmentTierBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded leading-none shrink-0 tracking-wide',
        environmentTierBadgeClass(tier),
        className
      )}
      title={title ?? tier}
    >
      {tier}
    </span>
  );
}

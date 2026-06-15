export function projectDetectedTooltip(frameworkLabel: string, endpointCount?: number): string {
  const base = `${frameworkLabel.trim()} project detected`;
  if (endpointCount !== undefined && endpointCount > 0) {
    return `${base} · ${endpointCount} endpoint${endpointCount === 1 ? '' : 's'}`;
  }
  return base;
}

export function projectDetectedMessage(frameworkLabel: string): string {
  return projectDetectedTooltip(frameworkLabel);
}

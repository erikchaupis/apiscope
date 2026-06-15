interface ResponseHeadersViewProps {
  headers: Record<string, string>;
  format: 'pretty' | 'raw';
}

export function ResponseHeadersView({ headers, format }: ResponseHeadersViewProps) {
  const entries = Object.entries(headers).sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    return (
      <div className="flex-1 overflow-auto p-3 text-xs font-mono text-muted-foreground">
        (no headers)
      </div>
    );
  }

  if (format === 'raw') {
    const headerLines = entries.map(([key, value]) => `${key}: ${value}`).join('\n');
    return (
      <pre className="flex-1 overflow-auto p-3 text-xs font-mono m-0 bg-background whitespace-pre-wrap break-words">
        {headerLines}
      </pre>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-card z-10">
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium w-[38%]">Header Name</th>
            <th className="px-3 py-2 font-medium">Header Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-border/50 hover:bg-accent/30">
              <td className="px-3 py-1.5 font-mono align-top text-foreground">{key}</td>
              <td className="px-3 py-1.5 font-mono break-all align-top text-foreground">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

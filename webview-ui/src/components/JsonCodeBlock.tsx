import { useEffect, useState } from 'react';
import { highlightJson } from '../lib/shiki';
import { tryFormatJson } from '../lib/utils';
import type { AppTheme } from '../types';

interface JsonCodeBlockProps {
  raw: string;
  theme: AppTheme;
}

export function JsonCodeBlock({ raw, theme }: JsonCodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { formatted, isJson } = tryFormatJson(raw);

  useEffect(() => {
    if (!isJson) {
      setHtml(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    highlightJson(formatted, theme)
      .then((result) => {
        if (!cancelled) {
          setHtml(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHtml(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [formatted, isJson, theme]);

  if (!raw) {
    return (
      <div className="flex-1 overflow-auto p-3 text-xs font-mono text-muted-foreground">
        (empty body)
      </div>
    );
  }

  if (!isJson) {
    return (
      <div className="flex-1 overflow-auto p-3">
        <div className="text-xs text-muted-foreground mb-2">Not valid JSON</div>
        <pre className="text-xs font-mono m-0 whitespace-pre-wrap break-words">{raw}</pre>
      </div>
    );
  }

  if (loading && !html) {
    return (
      <div className="flex-1 overflow-auto p-3">
        <pre className="text-xs font-mono m-0 whitespace-pre-wrap">{formatted}</pre>
      </div>
    );
  }

  if (!html) {
    return (
      <div className="flex-1 overflow-auto p-3">
        <pre className="text-xs font-mono m-0 whitespace-pre-wrap">{formatted}</pre>
      </div>
    );
  }

  return (
    <div
      className="shiki-container flex-1 overflow-auto p-3"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

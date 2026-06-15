import { useMemo } from 'react';
import type { AppTheme } from '../types';
import { VariableAutocompleteInput } from './VariableAutocompleteInput';
import { highlightJsonBodyWithVariables } from '../lib/jsonBodyHighlight';
import { isValidJsonWithVariables } from '../lib/jsonWithVariables';
import { cn } from '../lib/utils';

export type BodyEditorMode = 'json' | 'raw';

interface JsonBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  theme: AppTheme;
  mode: BodyEditorMode;
  readOnly?: boolean;
  variableSuggestions?: string[];
}

const EDITOR_CLASS =
  'w-full min-h-32 p-2 text-xs font-mono leading-[1.5] whitespace-pre-wrap break-words';

export function JsonBodyEditor({
  value,
  onChange,
  theme,
  mode,
  readOnly = false,
  variableSuggestions = [],
}: JsonBodyEditorProps) {
  const useJsonHighlight = mode === 'json';

  const highlightHtml = useMemo(() => {
    if (!useJsonHighlight) {
      return null;
    }
    return highlightJsonBodyWithVariables(value, theme);
  }, [value, theme, useJsonHighlight]);

  const jsonValid = useMemo(() => {
    if (!useJsonHighlight || !value.trim()) {
      return true;
    }
    return isValidJsonWithVariables(value);
  }, [value, useJsonHighlight]);

  return (
    <div className="space-y-1">
      <VariableAutocompleteInput
        value={value}
        readOnly={readOnly}
        suggestions={variableSuggestions}
        onChange={onChange}
        multiline
        rows={8}
        syntaxHighlightHtml={useJsonHighlight ? highlightHtml : undefined}
        className={cn(
          EDITOR_CLASS,
          'resize-y w-full',
          useJsonHighlight
            ? 'syntax-highlight-textarea bg-transparent border-0 rounded-none'
            : 'bg-background border border-border rounded'
        )}
        wrapperClassName={cn(
          useJsonHighlight &&
            cn(
              'rounded bg-background overflow-hidden border',
              jsonValid ? 'border-border' : 'border-warning'
            )
        )}
      />
      {useJsonHighlight && value.trim() && !jsonValid && (
        <p className="text-xs text-warning px-0.5">
          Invalid JSON. Unquoted {'{{variables}}'} are valid for numbers, booleans, and null — check
          for typos or stray characters.
        </p>
      )}
    </div>
  );
}

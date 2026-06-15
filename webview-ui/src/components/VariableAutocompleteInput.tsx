import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { cn } from '../lib/utils';

interface VariableAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  wrapperClassName?: string;
  multiline?: boolean;
  rows?: number;
  id?: string;
  syntaxHighlightHtml?: string | null;
  /** Called when Enter is pressed on a single-line input (autocomplete closed). */
  onSubmit?: () => void;
}

export type VariableAutocompleteInputHandle = HTMLInputElement | HTMLTextAreaElement;

function getAutocompleteMatch(
  value: string,
  cursor: number
): { prefix: string; replaceStart: number } | null {
  const before = value.slice(0, cursor);
  const open = before.lastIndexOf('{{');
  if (open < 0) {
    return null;
  }
  const afterOpen = before.slice(open + 2);
  if (afterOpen.includes('}}')) {
    return null;
  }
  if (!/^\w*$/.test(afterOpen)) {
    return null;
  }
  return { prefix: afterOpen, replaceStart: open };
}

export const VariableAutocompleteInput = forwardRef<
  VariableAutocompleteInputHandle,
  VariableAutocompleteInputProps
>(function VariableAutocompleteInput(
  {
    value,
    onChange,
    suggestions,
    readOnly = false,
    placeholder,
    className,
    wrapperClassName,
    multiline = false,
    rows = 3,
    id,
    syntaxHighlightHtml,
    onSubmit,
  },
  ref
) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => inputRef.current as VariableAutocompleteInputHandle);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cursor, setCursor] = useState(0);

  const match = useMemo(
    () => (open ? getAutocompleteMatch(value, cursor) : null),
    [open, value, cursor]
  );

  const filtered = useMemo(() => {
    if (!match) {
      return [];
    }
    const prefix = match.prefix.toLowerCase();
    return suggestions.filter((name) => name.toLowerCase().startsWith(prefix));
  }, [match, suggestions]);

  useEffect(() => {
    setActiveIndex(0);
  }, [match?.prefix, filtered.length]);

  const applySuggestion = (name: string) => {
    if (!match) {
      return;
    }
    const before = value.slice(0, match.replaceStart);
    const after = value.slice(cursor);
    const next = `${before}{{${name}}}${after}`;
    onChange(next);
    setOpen(false);
    const nextCursor = before.length + name.length + 4;
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(nextCursor, nextCursor);
        setCursor(nextCursor);
      }
    });
  };

  const handleChange = (nextValue: string, selectionStart: number | null) => {
    onChange(nextValue);
    const nextCursor = selectionStart ?? nextValue.length;
    setCursor(nextCursor);
    setOpen(getAutocompleteMatch(nextValue, nextCursor) !== null);
  };

  const syncBackdropScroll = () => {
    const textarea = inputRef.current;
    const backdrop = backdropRef.current;
    if (!textarea || !backdrop) {
      return;
    }
    backdrop.scrollTop = textarea.scrollTop;
    backdrop.scrollLeft = textarea.scrollLeft;
  };

  const useSyntaxHighlight = multiline && syntaxHighlightHtml !== undefined;

  const sharedProps = {
    id,
    value,
    readOnly,
    placeholder,
    className: cn(className),
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const start = e.currentTarget.selectionStart ?? value.length;
      setCursor(start);
      setOpen(getAutocompleteMatch(value, start) !== null);
    },
    onClick: (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const start = e.currentTarget.selectionStart ?? value.length;
      setCursor(start);
      setOpen(getAutocompleteMatch(value, start) !== null);
    },
    onKeyUp: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const start = e.currentTarget.selectionStart ?? value.length;
      setCursor(start);
      setOpen(getAutocompleteMatch(value, start) !== null);
    },
    onBlur: () => {
      window.setTimeout(() => setOpen(false), 120);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (open && filtered.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveIndex((index) => (index + 1) % filtered.length);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIndex((index) => (index - 1 + filtered.length) % filtered.length);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          applySuggestion(filtered[activeIndex]);
        } else if (e.key === 'Escape') {
          setOpen(false);
        }
        return;
      }
      if (
        onSubmit &&
        !multiline &&
        e.key === 'Enter' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault();
        onSubmit();
      }
    },
  };

  return (
    <div className={cn('relative min-w-0 flex-1', wrapperClassName)}>
      {useSyntaxHighlight && (
        <div
          ref={backdropRef}
          aria-hidden
          className="shiki-editor-backdrop absolute inset-0 overflow-auto pointer-events-none p-2"
        >
          {syntaxHighlightHtml ? (
            <div
              className="json-body-highlight min-h-full"
              dangerouslySetInnerHTML={{ __html: syntaxHighlightHtml }}
            />
          ) : null}
        </div>
      )}
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          rows={rows}
          {...sharedProps}
          onScroll={useSyntaxHighlight ? syncBackdropScroll : undefined}
          onChange={(e) => handleChange(e.target.value, e.target.selectionStart)}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          {...sharedProps}
          onChange={(e) => handleChange(e.target.value, e.target.selectionStart)}
        />
      )}
      {open && match && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded border border-border bg-card py-1 text-xs shadow-md"
        >
          {filtered.map((name, index) => (
            <li key={name}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  'w-full px-2 py-1 text-left font-mono hover:bg-accent',
                  index === activeIndex && 'bg-accent'
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applySuggestion(name);
                }}
              >
                {`{{${name}}}`}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

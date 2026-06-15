interface AutomationScriptEditorProps {
  id: string;
  value: string;
  placeholder: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
}

export function AutomationScriptEditor({
  id,
  value,
  placeholder,
  readOnly = false,
  onChange,
}: AutomationScriptEditorProps) {
  return (
    <textarea
      id={id}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      spellCheck={false}
      rows={6}
      className="w-full min-h-[120px] text-xs font-mono leading-relaxed bg-background border border-border rounded px-2 py-1.5 resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

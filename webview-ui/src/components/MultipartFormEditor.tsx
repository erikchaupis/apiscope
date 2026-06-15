import { AlertTriangle, FileText, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import {
  createEmptyMultipartField,
  formatFileSize,
  multipartFileDisplayName,
} from '../lib/requestBody';
import type { MultipartFieldType, MultipartFormField } from '../types';
import { cn } from '../lib/utils';

export interface UploadFilePathStatus {
  filePath: string;
  exists: boolean;
  fileName: string;
  fileSize?: number;
}

interface MultipartFormEditorProps {
  fields: MultipartFormField[];
  onChange: (fields: MultipartFormField[]) => void;
  readOnly?: boolean;
  onPickFile: (fieldIndex: number) => void;
  fileStatuses?: UploadFilePathStatus[];
}

export function MultipartFormEditor({
  fields,
  onChange,
  readOnly = false,
  onPickFile,
  fileStatuses = [],
}: MultipartFormEditorProps) {
  const statusByPath = useMemo(
    () => new Map(fileStatuses.map((status) => [status.filePath, status])),
    [fileStatuses]
  );

  const updateField = (index: number, patch: Partial<MultipartFormField>) => {
    const next = fields.map((field, i) => (i === index ? { ...field, ...patch } : field));
    onChange(next as MultipartFormField[]);
  };

  const changeFieldType = (index: number, type: MultipartFieldType) => {
    const current = fields[index];
    if (!current || current.type === type) {
      return;
    }
    const replacement =
      type === 'file'
        ? createEmptyMultipartField('file')
        : createEmptyMultipartField('text');
    const next = [...fields];
    next[index] = { ...replacement, key: current.key, enabled: current.enabled };
    onChange(next);
  };

  const addField = () => {
    onChange([...fields, createEmptyMultipartField('text')]);
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_88px_minmax(0,1.4fr)_24px] gap-1 px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>Key</span>
        <span>Type</span>
        <span>Value</span>
        <span />
      </div>
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1">No multipart fields.</p>
      ) : (
        fields.map((field, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(0,1fr)_88px_minmax(0,1.4fr)_24px] gap-1 items-start"
          >
            <div className="flex gap-1 min-w-0">
              <input
                type="checkbox"
                checked={field.enabled}
                disabled={readOnly}
                onChange={(e) => updateField(index, { enabled: e.target.checked })}
              />
              <input
                value={field.key}
                readOnly={readOnly}
                onChange={(e) => updateField(index, { key: e.target.value })}
                placeholder="Key"
                className="flex-1 min-w-0 bg-background border border-border rounded px-1.5 py-0.5 text-xs font-mono"
              />
            </div>
            <select
              value={field.type}
              disabled={readOnly}
              onChange={(e) => changeFieldType(index, e.target.value as MultipartFieldType)}
              className="w-full text-xs bg-background border border-border rounded px-1 py-0.5"
            >
              <option value="text">Text</option>
              <option value="file">File</option>
            </select>
            <div className="min-w-0">
              {field.type === 'text' ? (
                <input
                  value={field.value}
                  readOnly={readOnly}
                  onChange={(e) => updateField(index, { value: e.target.value })}
                  placeholder="Value"
                  className="w-full bg-background border border-border rounded px-1.5 py-0.5 text-xs font-mono"
                />
              ) : (
                <FileFieldValue
                  field={field}
                  readOnly={readOnly}
                  exists={field.filePath ? statusByPath.get(field.filePath)?.exists : undefined}
                  onPick={() => onPickFile(index)}
                />
              )}
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={() => removeField(index)}
                className="p-0.5 text-muted-foreground hover:text-danger shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))
      )}
      {!readOnly && (
        <button
          type="button"
          onClick={addField}
          className="text-xs flex items-center gap-0.5 hover:text-foreground text-muted-foreground px-1"
        >
          <Plus className="w-3 h-3" /> Add field
        </button>
      )}
    </div>
  );
}

function FileFieldValue({
  field,
  readOnly,
  exists,
  onPick,
}: {
  field: Extract<MultipartFormField, { type: 'file' }>;
  readOnly: boolean;
  exists?: boolean;
  onPick: () => void;
}) {
  const displayName = multipartFileDisplayName(field);
  const sizeLabel = formatFileSize(field.fileSize ?? statusBySizeFallback(field, exists));
  const missing = Boolean(field.filePath && exists === false);

  if (!displayName) {
    return (
      <button
        type="button"
        disabled={readOnly}
        onClick={onPick}
        className="text-xs px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-60"
      >
        Select File
      </button>
    );
  }

  return (
    <div className="rounded border border-border bg-background px-2 py-1.5 text-xs">
      <div className="flex items-start gap-2">
        <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className={cn('font-medium truncate', missing && 'text-warning')}>{displayName}</div>
          {sizeLabel && <div className="text-muted-foreground">{sizeLabel}</div>}
          {missing && (
            <div className="flex items-center gap-1 text-warning mt-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>File not found</span>
            </div>
          )}
        </div>
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={onPick}
          className="mt-2 text-xs px-2 py-0.5 rounded border border-border hover:bg-accent"
        >
          Change
        </button>
      )}
    </div>
  );
}

function statusBySizeFallback(
  field: Extract<MultipartFormField, { type: 'file' }>,
  exists?: boolean
): number | undefined {
  if (exists === false) {
    return undefined;
  }
  return field.fileSize;
}

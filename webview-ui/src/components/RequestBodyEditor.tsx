import { Plus, Trash2 } from 'lucide-react';
import {
  hasConflictingMultipartContentType,
  normalizeRequestBody,
  REQUEST_BODY_KIND_LABELS,
  setRequestBodyKind,
  updateMultipartFormData,
  updateRequestBodyContent,
  updateUrlEncodedBody,
} from '../lib/requestBody';
import type { ApiRequest, AppTheme, KeyValuePair, RequestBodyKind } from '../types';
import { JsonBodyEditor } from './JsonBodyEditor';
import { MultipartFormEditor, type UploadFilePathStatus } from './MultipartFormEditor';
import { VariableAutocompleteInput } from './VariableAutocompleteInput';

interface RequestBodyEditorProps {
  request: ApiRequest;
  onChange: (request: ApiRequest) => void;
  theme: AppTheme;
  readOnly?: boolean;
  variableSuggestions?: string[];
  onPickUploadFile: (fieldIndex: number) => void;
  uploadFileStatuses?: UploadFilePathStatus[];
}

const BODY_KINDS: RequestBodyKind[] = [
  'none',
  'json',
  'form-urlencoded',
  'raw',
  'multipart',
];

export function RequestBodyEditor({
  request,
  onChange,
  theme,
  readOnly = false,
  variableSuggestions = [],
  onPickUploadFile,
  uploadFileStatuses = [],
}: RequestBodyEditorProps) {
  const body = normalizeRequestBody(request);
  const contentTypeConflict = hasConflictingMultipartContentType(request);

  const updateUrlEncodedRow = (index: number, field: keyof KeyValuePair, value: string | boolean) => {
    const rows = [...(body.urlEncoded ?? [])];
    rows[index] = { ...rows[index], [field]: value };
    onChange(updateUrlEncodedBody(request, rows));
  };

  const addUrlEncodedRow = () => {
    onChange(
      updateUrlEncodedBody(request, [
        ...(body.urlEncoded ?? []),
        { key: '', value: '', enabled: true },
      ])
    );
  };

  const removeUrlEncodedRow = (index: number) => {
    onChange(updateUrlEncodedBody(request, (body.urlEncoded ?? []).filter((_, i) => i !== index)));
  };

  return (
    <div className="pt-2">
      <div className="flex items-center justify-end mb-2">
        <select
          value={body.kind}
          disabled={readOnly}
          onChange={(e) => onChange(setRequestBodyKind(request, e.target.value as RequestBodyKind))}
          className="text-[10px] leading-none bg-card border border-border rounded px-1 py-0.5 text-muted-foreground"
        >
          {BODY_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {REQUEST_BODY_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </div>

      {body.kind === 'none' && (
        <p className="text-xs text-muted-foreground px-1">This request does not have a body.</p>
      )}

      {(body.kind === 'json' || body.kind === 'raw') && (
        <JsonBodyEditor
          value={body.content ?? ''}
          onChange={(content) => onChange(updateRequestBodyContent(request, content))}
          theme={theme}
          mode={body.kind}
          readOnly={readOnly}
          variableSuggestions={variableSuggestions}
        />
      )}

      {body.kind === 'form-urlencoded' && (
        <div>
          <div className="flex items-center justify-end mb-2">
            {!readOnly && (
              <button
                type="button"
                onClick={addUrlEncodedRow}
                className="text-xs flex items-center gap-0.5 hover:text-foreground text-muted-foreground"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            )}
          </div>
          {(body.urlEncoded ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground px-1">No form fields.</p>
          ) : (
            (body.urlEncoded ?? []).map((row, index) => (
              <div key={index} className="flex gap-1 mb-1">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  disabled={readOnly}
                  onChange={(e) => updateUrlEncodedRow(index, 'enabled', e.target.checked)}
                />
                <input
                  value={row.key}
                  readOnly={readOnly}
                  onChange={(e) => updateUrlEncodedRow(index, 'key', e.target.value)}
                  placeholder="Key"
                  className="flex-1 min-w-0 bg-background border border-border rounded px-1.5 py-0.5 text-xs font-mono"
                />
                <VariableAutocompleteInput
                  value={row.value}
                  readOnly={readOnly}
                  suggestions={variableSuggestions}
                  onChange={(value) => updateUrlEncodedRow(index, 'value', value)}
                  placeholder="Value"
                  className="flex-[2] min-w-0 bg-background border border-border rounded px-1.5 py-0.5 text-xs font-mono"
                />
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeUrlEncodedRow(index)}
                    className="p-0.5 text-muted-foreground hover:text-danger shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {body.kind === 'multipart' && (
        <>
          {contentTypeConflict && (
            <p className="text-xs text-warning px-1 mb-2">
              A manual Content-Type header will be ignored; the client sets multipart boundaries
              automatically.
            </p>
          )}
          <MultipartFormEditor
          fields={body.formData ?? []}
          onChange={(formData) => onChange(updateMultipartFormData(request, formData))}
          readOnly={readOnly}
          onPickFile={onPickUploadFile}
          fileStatuses={uploadFileStatuses}
        />
        </>
      )}
    </div>
  );
}

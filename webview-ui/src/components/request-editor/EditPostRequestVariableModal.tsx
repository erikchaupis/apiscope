import { useState } from 'react';
import {
  POST_VARIABLE_SOURCE_LABELS,
  postRequestVariableTypeSummary,
} from '../../lib/postRequestVariables';
import type { PostRequestVariable } from '../../types';

interface EditPostRequestVariableModalProps {
  variable: PostRequestVariable;
  onSave: (patch: Partial<PostRequestVariable>) => void;
  onCancel: () => void;
}

export function EditPostRequestVariableModal({
  variable,
  onSave,
  onCancel,
}: EditPostRequestVariableModalProps) {
  const [extractor, setExtractor] = useState(() => {
    switch (variable.source) {
      case 'body':
        return variable.jsonPath ?? '';
      case 'headers':
        return variable.headerName ?? '';
      case 'cookies':
        return variable.cookieName ?? '';
    }
  });

  const extractorLabel =
    variable.source === 'body'
      ? 'JSON Path'
      : variable.source === 'headers'
        ? 'Header Name'
        : 'Cookie Name';

  const handleSave = () => {
    const trimmed = extractor.trim();
    if (!trimmed) {
      return;
    }
    switch (variable.source) {
      case 'body':
        onSave({ jsonPath: trimmed });
        break;
      case 'headers':
        onSave({ headerName: trimmed });
        break;
      case 'cookies':
        onSave({ cookieName: trimmed });
        break;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-4">
        <h3 className="font-semibold text-sm mb-1">Configure Extraction</h3>
        <p className="text-xs text-muted-foreground mb-4">
          {variable.name} · {POST_VARIABLE_SOURCE_LABELS[variable.source]}
        </p>
        <p className="text-xs text-muted-foreground mb-3">{postRequestVariableTypeSummary(variable)}</p>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">{extractorLabel}</label>
          <input
            type="text"
            value={extractor}
            onChange={(e) => setExtractor(e.target.value)}
            autoFocus
            className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm font-mono"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded border border-border hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!extractor.trim()}
            className="px-3 py-1.5 text-sm rounded bg-primary text-background font-medium disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { ResponseTestCheck } from '../../types';
import { validateResponseTestCheck } from '../../lib/responseTests';
import { TestCheckConfigForm } from './TestCheckConfigForm';

interface EditResponseTestModalProps {
  check: ResponseTestCheck;
  onSave: (check: ResponseTestCheck) => void;
  onCancel: () => void;
}

export function EditResponseTestModal({ check, onSave, onCancel }: EditResponseTestModalProps) {
  const [draft, setDraft] = useState<ResponseTestCheck>(check);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const validationError = validateResponseTestCheck(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSave(draft);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-4">
        <h3 className="font-semibold text-sm mb-1">Edit Check</h3>
        <p className="text-xs text-muted-foreground mb-4">Update validation settings.</p>

        <TestCheckConfigForm
          check={draft}
          showType
          onChange={(patch) => {
            setDraft((current) => ({ ...current, ...patch }));
            setError(null);
          }}
        />

        {error && <p className="text-xs text-danger mt-3">{error}</p>}

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
            className="px-3 py-1.5 text-sm rounded bg-primary text-background font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

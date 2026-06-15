import { useState } from 'react';

interface RenameCollectionModalProps {
  currentName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function RenameCollectionModal({
  currentName,
  onConfirm,
  onCancel,
}: RenameCollectionModalProps) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Collection name cannot be empty.');
      return;
    }
    if (trimmed.length > 100) {
      setError('Collection name must be 100 characters or fewer.');
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full mx-4 p-4">
        <h3 className="font-semibold text-sm mb-3">Rename Collection</h3>
        <label className="text-xs text-muted-foreground block mb-1">New collection name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          maxLength={100}
          className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm mb-2"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        {error && <p className="text-xs text-danger mb-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded border border-border hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-3 py-1.5 text-sm rounded bg-primary text-background font-medium"
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}

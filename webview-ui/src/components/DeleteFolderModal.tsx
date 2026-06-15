interface DeleteFolderModalProps {
  folderName: string;
  requestCount: number;
  subfolderCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteFolderModal({
  folderName,
  requestCount,
  subfolderCount,
  onConfirm,
  onCancel,
}: DeleteFolderModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl"
        role="dialog"
        aria-labelledby="delete-folder-title"
      >
        <h2 id="delete-folder-title" className="text-sm font-semibold mb-2">
          Delete Folder
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          Folder: <span className="text-foreground font-medium">{folderName}</span>
        </p>
        <ul className="text-sm text-muted-foreground mb-3 list-disc pl-5 space-y-1">
          <li>
            {requestCount} request{requestCount === 1 ? '' : 's'}
          </li>
          <li>
            {subfolderCount} subfolder{subfolderCount === 1 ? '' : 's'}
          </li>
        </ul>
        <p className="text-sm text-muted-foreground mb-4">This action cannot be undone.</p>
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
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm rounded bg-danger text-white hover:opacity-90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

interface DeleteEnvironmentModalProps {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteEnvironmentModal({ name, onConfirm, onCancel }: DeleteEnvironmentModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-sm w-full mx-4 p-4">
        <h3 className="font-semibold text-sm mb-2">Delete Environment</h3>
        <p className="text-sm text-muted-foreground mb-1">
          Environment: <span className="font-medium text-foreground">{name}</span>
        </p>
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
            className="px-3 py-1.5 text-sm rounded bg-danger text-background font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

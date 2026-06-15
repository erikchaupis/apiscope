interface ConfirmRescanModalProps {
  onContinue: () => void;
  onCancel: () => void;
}

export function ConfirmRescanModal({ onContinue, onCancel }: ConfirmRescanModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full mx-4 p-4">
        <h3 className="font-semibold text-sm mb-2">Refresh Generated Collection?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          The Generated Collection will be refreshed from source code.
          <br />
          <br />
          Custom changes may be overwritten.
        </p>
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
            onClick={onContinue}
            className="px-3 py-1.5 text-sm rounded bg-primary text-background font-medium"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

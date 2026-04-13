import * as AlertDialog from "@radix-ui/react-alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
}

export default function ConfirmDialog({ open, onConfirm, onCancel, title, description, confirmLabel = "Delete" }: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 animate-fade-in" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-zinc-900 rounded-lg shadow-2xl z-50 p-5 animate-fade-in outline-none">
          <AlertDialog.Title className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            {description}
          </AlertDialog.Description>
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <button className="px-3 py-1.5 text-sm font-medium rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 border-0 cursor-pointer transition-colors">
                Cancel
              </button>
            </AlertDialog.Cancel>
            <button
              onClick={onConfirm}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-red-600 hover:bg-red-700 text-white border-0 cursor-pointer transition-colors"
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

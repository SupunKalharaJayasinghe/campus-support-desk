"use client";

import { Loader2, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";

interface ConfirmDeleteOfferingModalProps {
  open: boolean;
  deleting: boolean;
  title?: string;
  message?: string;
  targetLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ConfirmDeleteOfferingModal({
  open,
  deleting,
  title = "Delete offering?",
  message = "This will remove the module offering assignment for this intake term.",
  targetLabel,
  onClose,
  onConfirm,
}: ConfirmDeleteOfferingModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        aria-modal="true"
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-white shadow-[0_18px_36px_rgba(15,23,42,0.2)]"
        role="dialog"
      >
        <div className="px-6 py-6">
          <p className="text-lg font-semibold text-heading">{title}</p>
          <p className="mt-2 text-sm leading-6 text-text/70">{message}</p>
          <p className="mt-2 text-sm font-semibold text-heading">{targetLabel}</p>
        </div>

        <div className="flex justify-end gap-2.5 border-t border-border bg-white px-6 py-4">
          <Button
            className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
            disabled={deleting}
            onClick={onClose}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            className="h-11 min-w-[132px] gap-2 bg-red-600 px-5 text-white shadow-[0_10px_24px_rgba(220,38,38,0.22)] hover:bg-red-700"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Delete
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

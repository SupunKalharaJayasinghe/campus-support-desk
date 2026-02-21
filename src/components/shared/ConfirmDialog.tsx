"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  variant = "warning"
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: "warning" | "danger";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant === "danger" ? "danger" : "outline"}
        onClick={() => setOpen(true)}
      >
        {confirmLabel}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={message}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {cancelLabel}
            </Button>
            <Button
              variant={variant === "danger" ? "danger" : "primary"}
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">{message}</p>
      </Modal>
    </>
  );
}

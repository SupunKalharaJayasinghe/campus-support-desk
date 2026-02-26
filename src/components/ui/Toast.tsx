import Button from "@/components/ui/Button";
import { X } from "lucide-react";

interface ToastProps {
  title: string;
  message?: string;
  onClose: () => void;
}

export default function Toast({ title, message, onClose }: ToastProps) {
  return (
    <div
      className="pointer-events-auto w-full rounded-2xl border border-border bg-surface p-4 shadow-card"
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text">{title}</p>
          {message ? <p className="mt-1 text-sm text-mutedText">{message}</p> : null}
        </div>
        <Button
          aria-label="Dismiss toast"
          className="h-7 w-7 rounded-lg p-0"
          onClick={onClose}
          variant="ghost"
        >
          <X size={14} />
        </Button>
      </div>
    </div>
  );
}

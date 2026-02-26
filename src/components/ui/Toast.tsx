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
      className="pointer-events-auto w-full rounded-3xl border border-border border-l-4 border-l-primary bg-card p-4 shadow-shadow"
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-heading">{title}</p>
          {message ? <p className="mt-1 text-sm text-text/74">{message}</p> : null}
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

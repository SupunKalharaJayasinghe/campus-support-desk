import Button from "@/components/ui/Button";

interface ToastProps {
  title: string;
  message?: string;
  onClose: () => void;
}

export default function Toast({ title, message, onClose }: ToastProps) {
  return (
    <div
      className="pointer-events-auto w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-lg"
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {message ? <p className="mt-1 text-sm text-slate-600">{message}</p> : null}
        </div>
        <Button
          aria-label="Dismiss toast"
          className="h-7 w-7 rounded-lg p-0"
          onClick={onClose}
          variant="ghost"
        >
          x
        </Button>
      </div>
    </div>
  );
}

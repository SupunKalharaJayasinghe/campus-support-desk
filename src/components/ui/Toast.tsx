import Button from "@/components/ui/Button";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

interface ToastProps {
  title: string;
  message?: string;
  variant: ToastVariant;
  duration: number;
  closing?: boolean;
  onClose: () => void;
}

const variantConfig: Record<
  ToastVariant,
  {
    label: string;
    Icon: typeof CheckCircle2;
    iconClassName: string;
    progressClassName: string;
  }
> = {
  success: {
    label: "Success",
    Icon: CheckCircle2,
    iconClassName:
      "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100",
    progressClassName: "bg-emerald-500",
  },
  error: {
    label: "Failed",
    Icon: AlertTriangle,
    iconClassName: "bg-rose-50 text-rose-600 ring-1 ring-rose-100",
    progressClassName: "bg-rose-500",
  },
  info: {
    label: "Info",
    Icon: Info,
    iconClassName: "bg-blue-50 text-blue-600 ring-1 ring-blue-100",
    progressClassName: "bg-blue-500",
  },
};

export default function Toast({
  title,
  message,
  variant,
  duration,
  closing,
  onClose,
}: ToastProps) {
  const { Icon, iconClassName, label, progressClassName } = variantConfig[variant];

  return (
    <div
      className={[
        "pointer-events-auto relative w-full overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.16)] ring-1 ring-black/5 transition-all duration-200",
        closing ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100",
      ].join(" ")}
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={[
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
              iconClassName,
            ].join(" ")}
          >
            <Icon size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text/55">
              {label}
            </p>
            <p className="mt-1 text-sm font-semibold text-heading">{title}</p>
            {message ? <p className="mt-1 text-sm leading-6 text-text/78">{message}</p> : null}
          </div>
        </div>
        <Button
          aria-label="Dismiss toast"
          className="h-8 w-8 shrink-0 rounded-xl border border-slate-200 bg-white p-0 text-text/70 hover:bg-slate-50 hover:text-heading"
          onClick={onClose}
          variant="ghost"
        >
          <X size={14} />
        </Button>
      </div>

      <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={["toast-progress h-full rounded-full", progressClassName].join(" ")}
          style={{ animationDuration: `${duration}ms` }}
        />
      </div>
    </div>
  );
}

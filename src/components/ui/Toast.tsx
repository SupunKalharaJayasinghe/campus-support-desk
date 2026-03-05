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
    containerClassName: string;
    iconClassName: string;
    textClassName: string;
    titleClassName: string;
    messageClassName: string;
    closeButtonClassName: string;
    trackClassName: string;
    progressClassName: string;
  }
> = {
  success: {
    label: "Success",
    Icon: CheckCircle2,
    containerClassName: "border-emerald-500/70 bg-emerald-700 ring-1 ring-emerald-400/30",
    iconClassName: "bg-white/18 text-white ring-1 ring-white/25",
    textClassName: "text-white/85",
    titleClassName: "text-white",
    messageClassName: "text-white/88",
    closeButtonClassName:
      "border-white/30 bg-white/10 text-white/85 hover:bg-white/20 hover:text-white",
    trackClassName: "bg-white/24",
    progressClassName: "bg-white",
  },
  error: {
    label: "Failed",
    Icon: AlertTriangle,
    containerClassName: "border-rose-500/70 bg-rose-700 ring-1 ring-rose-400/30",
    iconClassName: "bg-white/18 text-white ring-1 ring-white/25",
    textClassName: "text-white/85",
    titleClassName: "text-white",
    messageClassName: "text-white/88",
    closeButtonClassName:
      "border-white/30 bg-white/10 text-white/85 hover:bg-white/20 hover:text-white",
    trackClassName: "bg-white/24",
    progressClassName: "bg-white",
  },
  info: {
    label: "Info",
    Icon: Info,
    containerClassName:
      "border-[#1D4FA6]/80 bg-[#0339A6] ring-1 ring-[#6697E8]/35",
    iconClassName: "bg-white/18 text-white ring-1 ring-white/25",
    textClassName: "text-white/85",
    titleClassName: "text-white",
    messageClassName: "text-white/88",
    closeButtonClassName:
      "border-white/30 bg-white/10 text-white/85 hover:bg-white/20 hover:text-white",
    trackClassName: "bg-white/24",
    progressClassName: "bg-white",
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
  const {
    Icon,
    containerClassName,
    iconClassName,
    label,
    textClassName,
    titleClassName,
    messageClassName,
    closeButtonClassName,
    trackClassName,
    progressClassName,
  } = variantConfig[variant];

  return (
    <div
      className={[
        "pointer-events-auto relative w-full overflow-hidden rounded-3xl border p-4 shadow-[0_18px_40px_rgba(15,23,42,0.2)] transition-all duration-200",
        containerClassName,
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
            <p className={["text-[11px] font-semibold uppercase tracking-[0.12em]", textClassName].join(" ")}>
              {label}
            </p>
            <p className={["mt-1 text-sm font-semibold", titleClassName].join(" ")}>{title}</p>
            {message ? (
              <p className={["mt-1 text-sm leading-6", messageClassName].join(" ")}>{message}</p>
            ) : null}
          </div>
        </div>
        <Button
          aria-label="Dismiss toast"
          className={["h-8 w-8 shrink-0 rounded-xl border p-0", closeButtonClassName].join(" ")}
          onClick={onClose}
          variant="ghost"
        >
          <X size={14} />
        </Button>
      </div>

      <div className={["mt-4 h-1 w-full overflow-hidden rounded-full", trackClassName].join(" ")}>
        <div
          className={["toast-progress h-full rounded-full", progressClassName].join(" ")}
          style={{ animationDuration: `${duration}ms` }}
        />
      </div>
    </div>
  );
}

"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import Toast, { type ToastVariant } from "@/components/ui/Toast";

interface ToastPayload {
  title: string;
  message?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastItem extends ToastPayload {
  id: number;
  closing?: boolean;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  toast: (payload: ToastPayload) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const DEFAULT_DURATION = 4200;
const EXIT_DURATION = 180;

function inferVariant(title: string, message?: string): ToastVariant {
  const content = `${title} ${message ?? ""}`.toLowerCase();

  if (
    content.includes("failed") ||
    content.includes("error") ||
    content.includes("invalid") ||
    content.includes("exists")
  ) {
    return "error";
  }

  if (
    content.includes("info") ||
    content.includes("queued") ||
    content.includes("draft") ||
    content.includes("preview")
  ) {
    return "info";
  }

  return "success";
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const activeToastKeys = useRef(new Set<string>());

  const getToastKey = useCallback(
    (payload: Pick<ToastItem, "title" | "message" | "variant">) =>
      `${payload.variant}::${payload.title.trim().toLowerCase()}::${(payload.message ?? "")
        .trim()
        .toLowerCase()}`,
    []
  );

  const dismiss = useCallback((id: number, key: string) => {
    let didScheduleRemoval = false;

    activeToastKeys.current.delete(key);

    setToasts((previous) =>
      previous.map((item) => {
        if (item.id !== id || item.closing) {
          return item;
        }

        didScheduleRemoval = true;
        return { ...item, closing: true };
      })
    );

    if (!didScheduleRemoval) {
      return;
    }

    window.setTimeout(() => {
      setToasts((previous) => previous.filter((item) => item.id !== id));
    }, EXIT_DURATION);
  }, []);

  const toast = useCallback(
    ({ title, message, variant, duration }: ToastPayload) => {
      const id = nextId.current;
      nextId.current += 1;
      const resolvedDuration = duration ?? DEFAULT_DURATION;
      const resolvedVariant = variant ?? inferVariant(title, message);
      const key = getToastKey({
        title,
        message,
        variant: resolvedVariant,
      });

      if (activeToastKeys.current.has(key)) {
        return;
      }

      activeToastKeys.current.add(key);

      setToasts((previous) => [
        ...previous,
        {
          id,
          title,
          message,
          variant: resolvedVariant,
          duration: resolvedDuration,
        },
      ]);

      window.setTimeout(() => {
        dismiss(id, key);
      }, resolvedDuration);
    },
    [dismiss, getToastKey]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-atomic="true"
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-4 z-[999] flex w-[min(24rem,calc(100%-2rem))] flex-col gap-3"
      >
        {toasts.map((item) => (
          <div className={item.closing ? "toast-exit" : "toast-enter"} key={item.id}>
            <Toast
              closing={item.closing}
              duration={item.duration}
              message={item.message}
              onClose={() => dismiss(item.id, getToastKey(item))}
              title={item.title}
              variant={item.variant}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider.");
  }

  return context;
}

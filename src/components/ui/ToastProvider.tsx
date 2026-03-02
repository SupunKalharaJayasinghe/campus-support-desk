"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import Toast from "@/components/ui/Toast";

interface ToastPayload {
  title: string;
  message?: string;
}

interface ToastItem extends ToastPayload {
  id: number;
}

interface ToastContextValue {
  toast: (payload: ToastPayload) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((previous) => previous.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, message }: ToastPayload) => {
      const id = nextId.current;
      nextId.current += 1;

      setToasts((previous) => [...previous, { id, title, message }]);

      window.setTimeout(() => {
        dismiss(id);
      }, 3200);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-atomic="true"
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100%-2rem))] flex-col gap-2"
      >
        {toasts.map((item) => (
          <div className="toast-enter" key={item.id}>
            <Toast message={item.message} onClose={() => dismiss(item.id)} title={item.title} />
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

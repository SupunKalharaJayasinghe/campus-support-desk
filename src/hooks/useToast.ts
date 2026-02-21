import { useToastContext } from "@/components/shared/ToastProvider";

export function useToast() {
  return useToastContext();
}

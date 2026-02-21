import { useMemo } from "react";
import { mockLostItems } from "@/lib/mock-data";

export function useLostItems() {
  const lostItems = useMemo(() => mockLostItems, []);
  return {
    lostItems,
    loading: false
  };
}

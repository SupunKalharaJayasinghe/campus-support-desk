import { useMemo } from "react";
import { mockModules } from "@/lib/mock-data";

export function useModules() {
  const modules = useMemo(() => mockModules, []);
  return {
    modules,
    loading: false
  };
}

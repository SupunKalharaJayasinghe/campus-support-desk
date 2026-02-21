import { useMemo } from "react";
import { mockAssessments } from "@/lib/mock-data";

export function useAssessments() {
  const assessments = useMemo(() => mockAssessments, []);
  return {
    assessments,
    loading: false
  };
}

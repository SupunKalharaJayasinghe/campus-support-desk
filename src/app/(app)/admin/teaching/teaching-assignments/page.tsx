"use client";

import TeachingWorkspacePage from "../_components/TeachingWorkspacePage";
import { teachingAssignmentsConfig } from "../_components/teaching-page-data";

export default function TeachingAssignmentsPage() {
  return <TeachingWorkspacePage config={teachingAssignmentsConfig} />;
}


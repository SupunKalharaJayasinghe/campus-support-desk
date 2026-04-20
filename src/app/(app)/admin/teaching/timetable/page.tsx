"use client";

import TeachingWorkspacePage from "../_components/TeachingWorkspacePage";
import { timetableConfig } from "../_components/teaching-page-data";

export default function TimetablePage() {
  return <TeachingWorkspacePage config={timetableConfig} />;
}


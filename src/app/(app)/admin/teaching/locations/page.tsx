"use client";

import TeachingWorkspacePage from "../_components/TeachingWorkspacePage";
import { locationsConfig } from "../_components/teaching-page-data";

export default function LocationsPage() {
  return <TeachingWorkspacePage config={locationsConfig} />;
}


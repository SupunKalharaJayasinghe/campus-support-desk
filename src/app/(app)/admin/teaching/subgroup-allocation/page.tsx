"use client";

import TeachingWorkspacePage from "../_components/TeachingWorkspacePage";
import { subgroupAllocationConfig } from "../_components/teaching-page-data";

export default function SubgroupAllocationPage() {
  return <TeachingWorkspacePage config={subgroupAllocationConfig} />;
}


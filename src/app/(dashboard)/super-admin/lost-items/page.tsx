import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { LostItemList } from "@/components/features/lost-items/LostItemList";

export default function LostItemsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Lost Items"
        description="Track campus lost and found reports."
        showBreadcrumbs
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Pending" value="14" />
        <StatsCard title="Approved" value="22" />
        <StatsCard title="Claimed" value="8" />
      </div>
      <LostItemList />
    </div>
  );
}

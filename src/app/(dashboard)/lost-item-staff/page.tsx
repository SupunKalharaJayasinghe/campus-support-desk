import { StatsCard } from "@/components/shared/StatsCard";
import { LostItemList } from "@/components/features/lost-items/LostItemList";

export default function LostItemStaffDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Pending Review" value="14" change="+4" />
        <StatsCard title="Approved Items" value="22" change="+3" />
        <StatsCard title="Claimed Items" value="8" change="-1" trend="down" />
        <StatsCard title="Returned This Week" value="5" change="+2" />
      </div>
      <LostItemList />
    </div>
  );
}

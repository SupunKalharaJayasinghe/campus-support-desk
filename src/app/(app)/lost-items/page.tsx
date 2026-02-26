import Card from "@/components/ui/Card";
import { foundItemsSeed, lostItemReports } from "@/lib/mockData";

export default function LostItemsDashboardPage() {
  const pending = lostItemReports.filter((item) => item.status === "Pending Review").length;
  const verified = lostItemReports.filter((item) => item.status === "Verified").length;
  const stored = foundItemsSeed.filter((item) => item.status === "Stored").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">Lost & Found Dashboard</h1>
        <p className="text-sm text-mutedText">Operational overview for queue, found register, and claims.</p>
      </div>
      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-mutedText">Pending review</p>
          <p className="mt-2 text-3xl font-semibold text-text">{pending}</p>
        </Card>
        <Card>
          <p className="text-sm text-mutedText">Verified reports</p>
          <p className="mt-2 text-3xl font-semibold text-text">{verified}</p>
        </Card>
        <Card>
          <p className="text-sm text-mutedText">Stored found items</p>
          <p className="mt-2 text-3xl font-semibold text-text">{stored}</p>
        </Card>
      </section>
    </div>
  );
}

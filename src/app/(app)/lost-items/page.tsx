import Card from "@/components/ui/Card";
import { foundItemsSeed, lostItemReports } from "@/lib/mockData";

export default function LostItemsDashboardPage() {
  const pending = lostItemReports.filter((item) => item.status === "Pending Review").length;
  const verified = lostItemReports.filter((item) => item.status === "Verified").length;
  const stored = foundItemsSeed.filter((item) => item.status === "Stored").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Lost & Found Dashboard</h1>
        <p className="text-sm text-slate-500">Operational overview for queue, found register, and claims.</p>
      </div>
      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Pending review</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{pending}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Verified reports</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{verified}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Stored found items</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stored}</p>
        </Card>
      </section>
    </div>
  );
}

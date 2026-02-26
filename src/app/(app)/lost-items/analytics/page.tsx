import Card from "@/components/ui/Card";
import { foundItemsSeed, lostItemLocations, lostItemReports } from "@/lib/mockData";

export default function LostItemsAnalyticsPage() {
  const resolved = lostItemReports.filter((item) => item.status === "Claimed").length;
  const unresolved = lostItemReports.length - resolved;
  const returned = foundItemsSeed.filter((item) => item.status === "Returned").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500">Resolution metrics and top incident locations.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Resolved reports</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{resolved}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Unresolved reports</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{unresolved}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Returned found items</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{returned}</p>
        </Card>
      </section>

      <Card title="Top locations">
        <ul className="space-y-2">
          {lostItemLocations.map((row) => (
            <li className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2" key={row.location}>
              <span className="text-sm text-slate-700">{row.location}</span>
              <span className="text-sm font-semibold text-slate-900">{row.count}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

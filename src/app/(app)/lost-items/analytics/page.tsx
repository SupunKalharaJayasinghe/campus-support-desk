import Card from "@/components/ui/Card";
import { foundItemsSeed, lostItemLocations, lostItemReports } from "@/models/mockData";

export default function LostItemsAnalyticsPage() {
  const resolved = lostItemReports.filter((item) => item.status === "Claimed").length;
  const unresolved = lostItemReports.length - resolved;
  const returned = foundItemsSeed.filter((item) => item.status === "Returned").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-heading">Analytics</h1>
        <p className="mt-2 text-sm text-text/75">Resolution metrics and top incident locations.</p>
      </div>

      <section className="grid gap-5 sm:grid-cols-3">
        <Card accent>
          <p className="text-sm text-text/72">Resolved reports</p>
          <p className="mt-2 text-3xl font-semibold text-heading">{resolved}</p>
        </Card>
        <Card accent>
          <p className="text-sm text-text/72">Unresolved reports</p>
          <p className="mt-2 text-3xl font-semibold text-heading">{unresolved}</p>
        </Card>
        <Card accent>
          <p className="text-sm text-text/72">Returned found items</p>
          <p className="mt-2 text-3xl font-semibold text-heading">{returned}</p>
        </Card>
      </section>

      <Card title="Top locations">
        <ul className="space-y-2">
          {lostItemLocations.map((row) => {
            return (
              <li className="flex items-center justify-between rounded-2xl bg-tint px-3.5 py-2.5" key={row.location}>
                <span className="text-sm text-text/72">{row.location}</span>
                <span className="text-sm font-semibold text-heading">{row.count}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}


import Card from "@/components/ui/Card";
import { foundItemsSeed, lostItemLocations, lostItemReports } from "@/lib/mockData";

export default function LostItemsAnalyticsPage() {
  const resolved = lostItemReports.filter((item) => item.status === "Claimed").length;
  const unresolved = lostItemReports.length - resolved;
  const returned = foundItemsSeed.filter((item) => item.status === "Returned").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-text">Analytics</h1>
        <p className="text-sm text-mutedText">Resolution metrics and top incident locations.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-mutedText">Resolved reports</p>
          <p className="mt-2 text-3xl font-semibold text-text">{resolved}</p>
        </Card>
        <Card>
          <p className="text-sm text-mutedText">Unresolved reports</p>
          <p className="mt-2 text-3xl font-semibold text-text">{unresolved}</p>
        </Card>
        <Card>
          <p className="text-sm text-mutedText">Returned found items</p>
          <p className="mt-2 text-3xl font-semibold text-text">{returned}</p>
        </Card>
      </section>

      <Card title="Top locations">
        <ul className="space-y-2">
          {lostItemLocations.map((row) => {
            return (
              <li className="flex items-center justify-between rounded-xl bg-surface2 px-3 py-2" key={row.location}>
                <span className="text-sm text-mutedText">{row.location}</span>
                <span className="text-sm font-semibold text-text">{row.count}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

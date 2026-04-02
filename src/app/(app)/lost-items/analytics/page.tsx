"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import { PORTAL_DATA_KEYS, loadPortalData } from "@/models/portal-data";
import type { FoundItemRecord, LostItemReport } from "@/models/portal-types";

export default function LostItemsAnalyticsPage() {
  const [reports, setReports] = useState<LostItemReport[]>([]);
  const [foundItems, setFoundItems] = useState<FoundItemRecord[]>([]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      loadPortalData<LostItemReport[]>(PORTAL_DATA_KEYS.lostItemReports, []),
      loadPortalData<FoundItemRecord[]>(PORTAL_DATA_KEYS.foundItems, []),
    ]).then(([reportRows, foundRows]) => {
      if (cancelled) {
        return;
      }

      setReports(reportRows);
      setFoundItems(foundRows);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const resolved = reports.filter((item) => item.status === "Claimed").length;
  const unresolved = reports.length - resolved;
  const returned = foundItems.filter((item) => item.status === "Returned").length;

  const topLocations = useMemo(() => {
    const buckets = new Map<string, number>();

    reports.forEach((item) => {
      const location = String(item.location ?? "").trim();
      if (!location) {
        return;
      }

      buckets.set(location, (buckets.get(location) ?? 0) + 1);
    });

    return Array.from(buckets.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);
  }, [reports]);

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
          {topLocations.map((row) => {
            return (
              <li className="flex items-center justify-between rounded-2xl bg-tint px-3.5 py-2.5" key={row.location}>
                <span className="text-sm text-text/72">{row.location}</span>
                <span className="text-sm font-semibold text-heading">{row.count}</span>
              </li>
            );
          })}
          {topLocations.length === 0 ? (
            <li className="rounded-2xl bg-tint px-3.5 py-2.5 text-sm text-text/72">
              No incident locations available yet.
            </li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}

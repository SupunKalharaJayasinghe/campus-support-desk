"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import { PORTAL_DATA_KEYS, loadPortalData } from "@/models/portal-data";
import type { AdminMetric, PlatformKpi } from "@/models/portal-types";

export default function AdminAnalyticsPage() {
  const [adminMetrics, setAdminMetrics] = useState<AdminMetric[]>([]);
  const [platformKpis, setPlatformKpis] = useState<PlatformKpi[]>([]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      loadPortalData<AdminMetric[]>(PORTAL_DATA_KEYS.adminMetrics, []),
      loadPortalData<PlatformKpi[]>(PORTAL_DATA_KEYS.platformKpis, []),
    ]).then(([metrics, kpis]) => {
      if (cancelled) {
        return;
      }

      setAdminMetrics(metrics);
      setPlatformKpis(kpis);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-heading">Analytics</h1>
        <p className="mt-2 text-sm text-text/75">Platform-wide KPIs and operational insights.</p>
      </div>
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {platformKpis.map((kpi) => (
          <Card accent key={kpi.id}>
            <p className="text-sm text-text/72">{kpi.label}</p>
            <p className="mt-2 text-3xl font-semibold text-heading">{kpi.value}</p>
          </Card>
        ))}
        {platformKpis.length === 0 ? (
          <Card>
            <p className="text-sm text-text/72">No KPI data available.</p>
          </Card>
        ) : null}
      </section>
      <Card title="Trend snapshot">
        <div className="grid gap-3 sm:grid-cols-2">
          {adminMetrics.map((metric) => (
            <div className="rounded-2xl bg-tint p-3.5" key={metric.id}>
              <p className="text-sm font-medium text-text">{metric.label}</p>
              <p className="mt-1 text-sm text-text/72">
                {metric.value} • {metric.trend}
              </p>
            </div>
          ))}
          {adminMetrics.length === 0 ? (
            <p className="text-sm text-text/72">No metric trends available.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

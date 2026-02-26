import Card from "@/components/ui/Card";
import { adminMetrics, platformKpis } from "@/lib/mockData";

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-text">Analytics</h1>
        <p className="text-sm text-mutedText">Platform-wide KPIs and operational insights.</p>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {platformKpis.map((kpi) => (
          <Card key={kpi.id}>
            <p className="text-sm text-mutedText">{kpi.label}</p>
            <p className="mt-2 text-3xl font-semibold text-text">{kpi.value}</p>
          </Card>
        ))}
      </section>
      <Card title="Trend snapshot">
        <div className="grid gap-3 sm:grid-cols-2">
          {adminMetrics.map((metric) => (
            <div className="rounded-xl bg-surface2 p-3" key={metric.id}>
              <p className="text-sm font-medium text-text">{metric.label}</p>
              <p className="mt-1 text-sm text-mutedText">
                {metric.value} • {metric.trend}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

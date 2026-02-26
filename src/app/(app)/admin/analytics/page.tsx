import Card from "@/components/ui/Card";
import { adminMetrics, platformKpis } from "@/lib/mockData";

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500">Platform-wide KPIs and operational insights.</p>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {platformKpis.map((kpi) => (
          <Card key={kpi.id}>
            <p className="text-sm text-slate-500">{kpi.label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{kpi.value}</p>
          </Card>
        ))}
      </section>
      <Card title="Trend snapshot">
        <div className="grid gap-3 sm:grid-cols-2">
          {adminMetrics.map((metric) => (
            <div className="rounded-xl bg-slate-50 p-3" key={metric.id}>
              <p className="text-sm font-medium text-slate-800">{metric.label}</p>
              <p className="mt-1 text-sm text-slate-600">
                {metric.value} • {metric.trend}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

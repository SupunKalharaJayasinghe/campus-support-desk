import Card from "@/components/ui/Card";
import { adminMetrics } from "@/lib/mockData";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Super Admin Dashboard</h1>
        <p className="text-sm text-slate-500">Platform health, moderation, and governance overview.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {adminMetrics.map((metric) => (
          <Card key={metric.id}>
            <p className="text-sm text-slate-500">{metric.label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{metric.value}</p>
            <p className="mt-1 text-xs text-emerald-600">{metric.trend}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}

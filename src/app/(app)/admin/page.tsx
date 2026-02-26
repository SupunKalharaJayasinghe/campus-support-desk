import Card from "@/components/ui/Card";
import { adminMetrics } from "@/lib/mockData";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-heading">Super Admin Dashboard</h1>
        <p className="mt-2 text-sm text-text/75">Platform health, moderation, and governance overview.</p>
      </div>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {adminMetrics.map((metric) => (
          <Card accent key={metric.id}>
            <p className="text-sm text-text/72">{metric.label}</p>
            <p className="mt-2 text-3xl font-semibold text-heading">{metric.value}</p>
            <p className="mt-1 text-xs text-primaryHover">{metric.trend}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}

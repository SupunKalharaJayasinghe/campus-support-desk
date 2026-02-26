import Card from "@/components/ui/Card";
import { adminMetrics } from "@/lib/mockData";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">Super Admin Dashboard</h1>
        <p className="text-sm text-mutedText">Platform health, moderation, and governance overview.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {adminMetrics.map((metric) => (
          <Card key={metric.id}>
            <p className="text-sm text-mutedText">{metric.label}</p>
            <p className="mt-2 text-3xl font-semibold text-text">{metric.value}</p>
            <p className="mt-1 text-xs text-primary2">{metric.trend}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}

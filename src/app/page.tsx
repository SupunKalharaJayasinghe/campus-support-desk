import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-grid px-6 py-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <section className="flex flex-col gap-6">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Campus Student Support Desk
          </span>
          <h1 className="font-display text-4xl font-semibold text-slate-900 md:text-5xl">
            Unified support for students, staff, and campus operations.
          </h1>
          <p className="max-w-2xl text-base text-slate-600 md:text-lg">
            Explore the full multi-role dashboard experience with live layout
            scaffolding, responsive tables, and shared UI components.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login">
              <Button>Go to Login</Button>
            </Link>
            <Link href="/super-admin">
              <Button variant="outline">Super Admin Dashboard</Button>
            </Link>
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Role-based dashboards",
              description:
                "Tailored navigation and widgets for admins, lecturers, students, and staff."
            },
            {
              title: "Structured forms",
              description:
                "Reusable field components, validation, and toast feedback built in."
            },
            {
              title: "Scalable UI library",
              description:
                "Buttons, tables, modals, and data utilities for the entire product."
            }
          ].map((item) => (
            <Card key={item.title} title={item.title}>
              <p className="text-sm text-slate-600">{item.description}</p>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}

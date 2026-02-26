"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { HOME_BY_ROLE, readStoredRole } from "@/lib/rbac";

const problems = [
  {
    title: "Communication Gap",
    description:
      "Announcements, updates, and academic support messages are split across disconnected channels.",
  },
  {
    title: "Lecturer Access",
    description:
      "Students need a clear and dependable way to discover lecturer availability and request meetings.",
  },
  {
    title: "Fragmented Assessments",
    description:
      "Assessments, feedback, and progress tracking are spread out, reducing clarity for everyone.",
  },
  {
    title: "Lost Items",
    description:
      "Lost-and-found reporting and claim verification often run on manual workflows with little visibility.",
  },
];

export default function LandingPage() {
  const [ctaHref, setCtaHref] = useState("/login");

  useEffect(() => {
    const role = readStoredRole();
    setCtaHref(role ? HOME_BY_ROLE[role] : "/login");
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">UniHub</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            UniHub – Smart Academic & Student Support Portal
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            A role-based platform demo for student services, lecturer workflows, lost-item
            operations, and platform administration.
          </p>
          <div className="mt-6">
            <Link href={ctaHref}>
              <Button>Enter Demo</Button>
            </Link>
          </div>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {problems.map((problem) => (
            <Card key={problem.title}>
              <h2 className="text-base font-semibold text-slate-900">{problem.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{problem.description}</p>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}

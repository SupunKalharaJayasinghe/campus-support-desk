"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
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
    <div className="min-h-screen bg-bg">
      <section className="w-full border-b border-border bg-surface py-14">
        <Container size="6xl">
          <div className="rounded-2xl border border-border bg-surface p-8 shadow-card sm:p-10">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-mutedText">UniHub</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text sm:text-4xl">
            UniHub – Smart Academic & Student Support Portal
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-mutedText sm:text-base">
              A role-based platform demo for student services, lecturer workflows, lost-item
              operations, and platform administration.
            </p>
            <div className="mt-6">
              <Link href={ctaHref}>
                <Button>Enter Demo</Button>
              </Link>
            </div>
          </div>
        </Container>
      </section>
      <main className="py-10">
        <Container size="6xl">
          <section className="grid gap-4 sm:grid-cols-2">
          {problems.map((problem) => (
            <Card key={problem.title}>
              <h2 className="text-base font-semibold text-text">{problem.title}</h2>
              <p className="mt-2 text-sm text-mutedText">{problem.description}</p>
            </Card>
          ))}
          </section>
        </Container>
      </main>
    </div>
  );
}

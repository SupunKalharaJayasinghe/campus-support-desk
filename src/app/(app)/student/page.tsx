"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { notificationsByRole, studentSummary } from "@/lib/mockData";

export default function StudentDashboardPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 500);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-8 w-16" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">Student Dashboard</h1>
        <p className="text-sm text-mutedText">Your academic support overview for this week.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-mutedText">Notifications</p>
          <p className="mt-2 text-3xl font-semibold text-text">{studentSummary.notifications}</p>
        </Card>
        <Card>
          <p className="text-sm text-mutedText">Bookings</p>
          <p className="mt-2 text-3xl font-semibold text-text">{studentSummary.bookings}</p>
        </Card>
        <Card>
          <p className="text-sm text-mutedText">Posts</p>
          <p className="mt-2 text-3xl font-semibold text-text">{studentSummary.posts}</p>
        </Card>
        <Card>
          <p className="text-sm text-mutedText">Points</p>
          <p className="mt-2 text-3xl font-semibold text-text">{studentSummary.points}</p>
        </Card>
      </section>

      <Card title="Recent Alerts">
        <ul className="space-y-3">
          {notificationsByRole.STUDENT.slice(0, 3).map((item) => (
            <li className="rounded-xl bg-surface2 p-3" key={item.id}>
              <p className="text-sm font-medium text-text">{item.title}</p>
              <p className="mt-1 text-xs text-mutedText">{item.time}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

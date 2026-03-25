"use client";

import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { studentActivity, studentLeaderboard, studentProfile } from "@/models/mockData";

function levelVariant(level: string) {
  if (level === "Champion") {
    return "danger" as const;
  }
  if (level === "Expert") {
    return "warning" as const;
  }
  if (level === "Contributor") {
    return "success" as const;
  }
  return "neutral" as const;
}

export default function StudentGamificationPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 500);
    return () => window.clearTimeout(timer);
  }, []);

  const progress = useMemo(() => {
    const currentBandStart = studentProfile.level === "Contributor" ? 200 : 0;
    const target = studentProfile.nextLevelPoints - currentBandStart;
    const completed = studentProfile.points - currentBandStart;
    return Math.min(100, Math.round((completed / target) * 100));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <Card>
          <Skeleton className="h-24 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Gamification</h1>
        <p className="text-sm text-text/72">Track points, badges, and leaderboard progress.</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title="Current User">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-semibold text-heading">{studentProfile.points} XP</p>
              <p className="mt-1 text-sm text-text/72">Maya Rodrigo</p>
            </div>
            <Badge variant={levelVariant(studentProfile.level)}>{studentProfile.level}</Badge>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-tint">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-text/72">
            {studentProfile.nextLevelPoints - studentProfile.points} XP to next level
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {studentProfile.trophies.map((trophy) => (
              <span
                className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                key={trophy}
              >
                {trophy}
              </span>
            ))}
          </div>
        </Card>

        <Card title="How to earn points">
          <ul className="space-y-3">
            <li className="rounded-xl bg-tint p-3 text-sm text-text/72">
              Complete quiz on time <span className="font-semibold">+35 XP</span>
            </li>
            <li className="rounded-xl bg-tint p-3 text-sm text-text/72">
              Score above 80% <span className="font-semibold">+20 Bonus</span>
            </li>
            <li className="rounded-xl bg-tint p-3 text-sm text-text/72">
              Reach milestone <span className="font-semibold">Trophy unlock</span>
            </li>
          </ul>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card title="Leaderboard">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-text/72">
                <th className="py-2">Rank</th>
                <th className="py-2">Name</th>
                <th className="py-2">Points</th>
                <th className="py-2">Level</th>
              </tr>
            </thead>
            <tbody>
              {studentLeaderboard.map((entry, index) => (
                <tr
                  className={index === 0 ? "bg-primary/10" : ""}
                  key={entry.id}
                >
                  <td className="py-3">{index + 1}</td>
                  <td className="py-3">{entry.name}</td>
                  <td className="py-3">{entry.points}</td>
                  <td className="py-3">
                    <Badge variant={levelVariant(entry.level)}>{entry.level}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Activity">
          <ul className="space-y-2">
              {studentActivity.slice(0, 5).map((item) => (
              <li className="rounded-xl bg-tint p-3" key={item.id}>
                <p className="text-sm text-text/72">{item.action}</p>
                <p className="mt-1 text-xs text-text/72">{item.time}</p>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}


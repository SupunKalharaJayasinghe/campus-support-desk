"use client";

import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { PORTAL_DATA_KEYS, loadPortalData } from "@/models/portal-data";
import type {
  ActivityItem,
  LeaderboardItem,
  StudentProfile,
} from "@/models/portal-types";
import { readStoredUser } from "@/models/rbac";

interface StudentGamificationPayload {
  profile: StudentProfile;
  leaderboard: LeaderboardItem[];
  activity: ActivityItem[];
}

const DEFAULT_PROFILE: StudentProfile = {
  points: 0,
  level: "Beginner",
  nextLevelPoints: 100,
  trophies: [],
};

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
  const user = useMemo(() => readStoredUser(), []);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StudentProfile>(DEFAULT_PROFILE);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    void loadPortalData<StudentGamificationPayload | null>(
      PORTAL_DATA_KEYS.studentGamification,
      null
    ).then((payload) => {
      if (cancelled) {
        return;
      }

      setProfile(payload?.profile ?? DEFAULT_PROFILE);
      setLeaderboard(payload?.leaderboard ?? []);
      setActivity(payload?.activity ?? []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const progress = useMemo(() => {
    const currentBandStart = profile.level === "Contributor" ? 200 : 0;
    const target = Math.max(1, profile.nextLevelPoints - currentBandStart);
    const completed = Math.max(0, profile.points - currentBandStart);
    return Math.min(100, Math.round((completed / target) * 100));
  }, [profile]);

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
              <p className="text-3xl font-semibold text-heading">{profile.points} XP</p>
              <p className="mt-1 text-sm text-text/72">{String(user?.name ?? "Student")}</p>
            </div>
            <Badge variant={levelVariant(profile.level)}>{profile.level}</Badge>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-tint">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-text/72">
            {Math.max(0, profile.nextLevelPoints - profile.points)} XP to next level
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.trophies.map((trophy) => (
              <span
                className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                key={trophy}
              >
                {trophy}
              </span>
            ))}
            {profile.trophies.length === 0 ? (
              <span className="text-xs text-text/70">No trophies yet.</span>
            ) : null}
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
              {leaderboard.map((entry, index) => (
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
          {leaderboard.length === 0 ? (
            <p className="mt-3 text-sm text-text/72">No leaderboard records available.</p>
          ) : null}
        </Card>

        <Card title="Activity">
          <ul className="space-y-2">
            {activity.slice(0, 5).map((item) => (
              <li className="rounded-xl bg-tint p-3" key={item.id}>
                <p className="text-sm text-text/72">{item.action}</p>
                <p className="mt-1 text-xs text-text/72">{item.time}</p>
              </li>
            ))}
          </ul>
          {activity.length === 0 ? (
            <p className="mt-3 text-sm text-text/72">No recent activity available.</p>
          ) : null}
        </Card>
      </section>
    </div>
  );
}

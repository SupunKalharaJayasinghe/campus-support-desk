"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import { authHeaders } from "@/models/rbac";

interface LecturerCourseItem {
  id: string;
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  intakeId: string;
  intakeName: string;
  termCode: string;
  currentWeekNo: number | null;
  totalWeeks: number;
  assignedLecturer: boolean;
}

interface LecturerCoursePayload {
  items: LecturerCourseItem[];
  total: number;
}

export default function LecturerMyCoursePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<LecturerCoursePayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const response = await fetch("/api/lecturer/my-course", {
          cache: "no-store",
          headers: {
            ...authHeaders(),
          },
        });
        const payload = (await response.json().catch(() => null)) as
          | LecturerCoursePayload
          | { message?: string }
          | null;
        if (!response.ok) {
          throw new Error(
            payload && typeof payload === "object" && "message" in payload
              ? payload.message || "Failed to load course modules."
              : "Failed to load course modules."
          );
        }

        if (!cancelled) {
          const normalizedPayload = (payload ?? {
            items: [],
            total: 0,
          }) as LecturerCoursePayload;
          setData({
            items: Array.isArray(normalizedPayload.items)
              ? normalizedPayload.items
              : [],
            total: Math.max(0, Number(normalizedPayload.total) || 0),
          });
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Failed to load course modules."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-52" />
        <Card>
          <Skeleton className="h-12 w-full" />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <h1 className="text-2xl font-semibold text-red-900">My Course</h1>
        <p className="mt-2 text-sm text-red-800/85">{error}</p>
      </Card>
    );
  }

  const modules = data?.items ?? [];

  return (
    <div className="space-y-5">
      <Card>
        <h1 className="text-2xl font-semibold text-heading">My Course</h1>
        <p className="mt-2 text-sm text-text/75">
          Weekly teaching content is assigned by academic week and intake-derived dates.
        </p>
      </Card>

      {modules.length === 0 ? (
        <Card>
          <p className="text-sm text-text/75">
            No active module offerings are assigned to your lecturer account.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {modules.map((module) => (
            <Card key={module.id}>
              <p className="text-sm font-semibold text-heading">{module.moduleCode}</p>
              <p className="mt-1 text-sm text-text/80">{module.moduleName}</p>
              <p className="mt-2 text-xs text-text/65">
                {module.intakeName} • {module.termCode} • {module.totalWeeks} weeks
              </p>
              <p className="mt-1 text-xs text-text/60">
                {module.currentWeekNo ? `Current: Week ${module.currentWeekNo}` : "No active week"}
              </p>
              <div className="mt-4">
                <Link href={`/lecturer/my-course/${encodeURIComponent(module.id)}`}>
                  <Button className="h-10 px-4" variant="secondary">
                    Manage Weekly Content
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import { authHeaders } from "@/models/rbac";

interface StudentCourseItem {
  id: string;
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  termCode: string;
  intakeId: string;
  intakeName: string;
  totalWeeks: number;
  currentWeekNo: number | null;
  hasCurrentWeekContent: boolean;
  updatedAt: string;
}

interface StudentCoursePayload {
  items: StudentCourseItem[];
  total: number;
  enrollment?: {
    intakeId: string;
    facultyId: string;
    degreeProgramId: string;
    stream: string;
    subgroup: string | null;
  } | null;
  intake?: {
    id: string;
    name: string;
    currentTerm: string;
  } | null;
  currentWeekNo?: number | null;
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleString();
}

export default function StudentMyCoursePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<StudentCoursePayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const response = await fetch("/api/student/my-course", {
          cache: "no-store",
          headers: {
            ...authHeaders(),
          },
        });
        const payload = (await response.json().catch(() => null)) as
          | StudentCoursePayload
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
          }) as StudentCoursePayload;
          setData({
            items: Array.isArray(normalizedPayload.items)
              ? normalizedPayload.items
              : [],
            total: Math.max(0, Number(normalizedPayload.total) || 0),
            enrollment: normalizedPayload.enrollment ?? null,
            intake: normalizedPayload.intake ?? null,
            currentWeekNo:
              normalizedPayload.currentWeekNo === null ||
              normalizedPayload.currentWeekNo === undefined
                ? null
                : Number(normalizedPayload.currentWeekNo),
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
      <div className="student-course-page space-y-4">
        <Skeleton className="h-7 w-44" />
        <Card>
          <Skeleton className="h-12 w-full" />
        </Card>
        <Card>
          <Skeleton className="h-28 w-full" />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="student-course-page">
        <Card>
          <h1 className="text-2xl font-semibold text-red-900">My Course</h1>
          <p className="mt-2 text-sm text-red-800/85">{error}</p>
        </Card>
      </div>
    );
  }

  const modules = data?.items ?? [];

  return (
    <div className="student-course-page space-y-5">
      <Card>
        <h1 className="text-2xl font-semibold text-heading">My Course</h1>
        <p className="mt-2 text-sm text-text/75">
          {data?.intake?.name || "Your intake"} •{" "}
          {data?.intake?.currentTerm || "Current semester"}{" "}
          {data?.currentWeekNo ? `• Current week: Week ${data.currentWeekNo}` : ""}
        </p>
      </Card>

      {modules.length === 0 ? (
        <Card>
          <p className="text-sm text-text/75">
            No modules are assigned for your current intake and semester yet.
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
              <p className="mt-1 text-xs text-text/55">
                Last update: {formatDateTime(module.updatedAt)}
              </p>
              <div className="mt-4">
                <Link href={`/student/my-course/${encodeURIComponent(module.id)}`}>
                  <Button className="h-10 px-4" variant="secondary">
                    Open Module
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

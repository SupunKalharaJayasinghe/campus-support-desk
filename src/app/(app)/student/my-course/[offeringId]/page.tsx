"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import { authHeaders } from "@/models/rbac";

interface WeekResourceItem {
  id: string;
  title: string;
  url: string;
  description: string;
}

interface WeekAssignmentItem {
  id: string;
  title: string;
  description: string;
  link: string;
}

interface WeekTodoItem {
  id: string;
  text: string;
}

interface StudentCourseWeek {
  weekNo: number;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
  outline: string;
  lectureSlides: WeekResourceItem[];
  resources: WeekResourceItem[];
  assignments: WeekAssignmentItem[];
  todoItems: WeekTodoItem[];
  updatedAt: string;
}

interface StudentCourseDetailPayload {
  offering: {
    id: string;
    moduleId: string;
    moduleCode: string;
    moduleName: string;
    intakeId: string;
    intakeName: string;
    termCode: string;
    currentWeekNo: number | null;
  };
  weeks: StudentCourseWeek[];
}

function formatDateOnly(value: string) {
  if (!value) {
    return "TBA";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString();
}

function WeekLinkList({ items }: { items: WeekResourceItem[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-text/60">No items.</p>;
  }

  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <div className="rounded-xl border border-border/70 bg-white px-3 py-2" key={item.id}>
          <p className="text-xs font-semibold text-heading">{item.title}</p>
          {item.description ? <p className="mt-0.5 text-xs text-text/70">{item.description}</p> : null}
          {item.url ? (
            <a
              className="mt-1 inline-flex text-xs text-[#034aa6] hover:underline"
              href={item.url}
              rel="noreferrer"
              target="_blank"
            >
              {item.url}
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function StudentCourseDetailPage() {
  const params = useParams<{ offeringId: string }>();
  const offeringId = String(params?.offeringId ?? "").trim();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<StudentCourseDetailPayload | null>(null);

  useEffect(() => {
    if (!offeringId) {
      setError("Module offering id is required.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const response = await fetch(
          `/api/student/my-course/${encodeURIComponent(offeringId)}`,
          {
            cache: "no-store",
            headers: {
              ...authHeaders(),
            },
          }
        );
        const payload = (await response.json().catch(() => null)) as
          | StudentCourseDetailPayload
          | { message?: string }
          | null;
        if (!response.ok) {
          throw new Error(
            payload && typeof payload === "object" && "message" in payload
              ? payload.message || "Failed to load module detail."
              : "Failed to load module detail."
          );
        }

        if (!cancelled) {
          setData(payload as StudentCourseDetailPayload);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Failed to load module detail."
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
  }, [offeringId]);

  const currentWeek = useMemo(
    () => data?.weeks.find((week) => week.isCurrent) ?? null,
    [data]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-52" />
        <Card>
          <Skeleton className="h-16 w-full" />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <h1 className="text-2xl font-semibold text-red-900">My Course</h1>
        <p className="mt-2 text-sm text-red-800/85">{error}</p>
        <div className="mt-4">
          <Link href="/student/my-course">
            <Button variant="secondary">Back to My Course</Button>
          </Link>
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <p className="text-sm text-text/75">Module details are unavailable.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <h1 className="text-2xl font-semibold text-heading">
          {data.offering.moduleCode} - {data.offering.moduleName}
        </h1>
        <p className="mt-2 text-sm text-text/75">
          {data.offering.intakeName} • {data.offering.termCode}
          {currentWeek ? ` • Active week: Week ${currentWeek.weekNo}` : ""}
        </p>
        <div className="mt-4">
          <Link href="/student/my-course">
            <Button variant="secondary">Back to My Course</Button>
          </Link>
        </div>
      </Card>

      <div className="space-y-4">
        {data.weeks.map((week) => (
          <Card
            className={
              week.isCurrent
                ? "border-[#034aa6] bg-[linear-gradient(135deg,rgba(3,74,166,0.08),rgba(255,255,255,1))]"
                : ""
            }
            key={week.weekNo}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base font-semibold text-heading">
                Week {week.weekNo}
                {week.isCurrent ? " (Current)" : ""}
              </p>
              <p className="text-xs text-text/65">
                {formatDateOnly(week.startDate)} - {formatDateOnly(week.endDate)}
              </p>
            </div>

            <p className="mt-2 text-sm text-text/80">{week.outline || `Week ${week.weekNo}`}</p>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-text/65">
                  Lecture Slides
                </p>
                <WeekLinkList items={week.lectureSlides} />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-text/65">
                  Module Resources
                </p>
                <WeekLinkList items={week.resources} />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-text/65">
                  Assignments
                </p>
                {week.assignments.length === 0 ? (
                  <p className="text-xs text-text/60">No assignments.</p>
                ) : (
                  <div className="space-y-1.5">
                    {week.assignments.map((item) => (
                      <div className="rounded-xl border border-border/70 bg-white px-3 py-2" key={item.id}>
                        <p className="text-xs font-semibold text-heading">{item.title}</p>
                        {item.description ? (
                          <p className="mt-0.5 text-xs text-text/70">{item.description}</p>
                        ) : null}
                        {item.link ? (
                          <a
                            className="mt-1 inline-flex text-xs text-[#034aa6] hover:underline"
                            href={item.link}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {item.link}
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-text/65">
                  Weekly Todo
                </p>
                {week.todoItems.length === 0 ? (
                  <p className="text-xs text-text/60">No todo items.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {week.todoItems.map((item) => (
                      <li className="rounded-xl border border-border/70 bg-white px-3 py-2 text-xs text-text/80" key={item.id}>
                        {item.text}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

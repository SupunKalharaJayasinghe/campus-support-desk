"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TablePagination from "@/components/admin/TablePagination";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/ToastProvider";
import { useGrouping } from "./GroupingContext";

type TabTrack = "weekday" | "weekend";
type PageSize = 10 | 25 | 50 | 100;

function isTabTrack(value: string | null): value is TabTrack {
  return value === "weekday" || value === "weekend";
}

function trackTitle(track: TabTrack) {
  return track === "weekday" ? "Weekday" : "Weekend";
}

function StudentGroupingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { students, groupOptions, assignStudentToGroup } = useGrouping();
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(1);

  const tabParam = searchParams.get("tab");
  const activeTab: TabTrack = isTabTrack(tabParam) ? tabParam : "weekday";

  const weekdayCount = students.filter((student) => student.track === "weekday").length;
  const weekendCount = students.filter((student) => student.track === "weekend").length;

  const tabStudents = useMemo(
    () => students.filter((student) => student.track === activeTab),
    [activeTab, students]
  );
  const pageCount = Math.max(1, Math.ceil(tabStudents.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedStudents = tabStudents.slice((safePage - 1) * pageSize, safePage * pageSize);

  const setTab = (nextTab: TabTrack) => {
    setPage(1);
    router.replace(`/admin/groups?tab=${nextTab}`);
  };

  const setDraftGroup = (studentId: string, value: string) => {
    setGroupDrafts((previous) => ({ ...previous, [studentId]: value }));
  };

  const assignGroup = (studentId: string, studentName: string, currentGroup?: string) => {
    const currentValue = currentGroup ?? "unassigned";
    const draftValue = groupDrafts[studentId] ?? currentValue;
    const nextGroup = draftValue === "unassigned" ? null : draftValue;
    const updated = assignStudentToGroup(studentId, nextGroup);
    if (!updated) return;

    setGroupDrafts((previous) => {
      const next = { ...previous };
      delete next[studentId];
      return next;
    });

    toast({
      title: "Saved",
      message: "Group assignment updated.",
      variant: "success",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[#0A0A0A]">
          Student Grouping
        </h1>
        <p className="mt-2 text-sm text-[#26150F]/78">
          Assign students into Weekday / Weekend tracks and manage grouping.
        </p>
      </div>

      <Card className="rounded-3xl border border-[#26150F]/25 bg-white p-6 shadow-[0_8px_24px_rgba(38,21,15,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="grid grid-cols-2 rounded-2xl border border-[#26150F]/20 bg-[#034AA6]/6 p-1">
            {(["weekday", "weekend"] as const).map((tab) => {
              const isActive = tab === activeTab;
              return (
                <button
                  className={[
                    "inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-white text-[#034AA6] shadow-[0_4px_12px_rgba(3,74,166,0.16)]"
                      : "text-[#26150F]/75 hover:text-[#0339A6]",
                  ].join(" ")}
                  key={tab}
                  onClick={() => setTab(tab)}
                  type="button"
                >
                  <span>{trackTitle(tab)}</span>
                  <Badge variant={isActive ? "primary" : "neutral"}>
                    {tab === "weekday" ? weekdayCount : weekendCount}
                  </Badge>
                </button>
              );
            })}
          </div>

          <Button
            className="bg-[#034AA6] text-white hover:bg-[#0339A6]"
            onClick={() => router.push(`/admin/groups/add-students?track=${activeTab}`)}
          >
            + Add Student
          </Button>
        </div>
      </Card>

      <div>
        <Card className="rounded-3xl border border-[#26150F]/25 bg-white p-6 shadow-[0_8px_24px_rgba(38,21,15,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-[#0A0A0A]">
              {trackTitle(activeTab)} Track Preview
            </h2>
            <Button
              className="bg-[#034AA6] text-white hover:bg-[#0339A6]"
              onClick={() => router.push(`/admin/groups/add-students?track=${activeTab}`)}
            >
              + Add Student
            </Button>
          </div>
          <p className="mt-1 text-sm text-[#26150F]/70">
            Showing current students assigned to {trackTitle(activeTab)}.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#26150F]/15">
            <div className="max-h-[340px] overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#26150F]/4 text-[#26150F]/78">
                    <th className="sticky top-0 bg-[#F7F6F6] px-3 py-3 text-left">Student</th>
                    <th className="sticky top-0 bg-[#F7F6F6] px-3 py-3 text-left">Campus ID</th>
                    <th className="sticky top-0 bg-[#F7F6F6] px-3 py-3 text-left">Degree</th>
                    <th className="sticky top-0 bg-[#F7F6F6] px-3 py-3 text-left">Year/Sem</th>
                    <th className="sticky top-0 bg-[#F7F6F6] px-3 py-3 text-left">Group</th>
                    <th className="sticky top-0 bg-[#F7F6F6] px-3 py-3 text-left">Assign Group</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedStudents.map((student) => {
                    const currentValue = student.group ?? "unassigned";
                    const draftValue = groupDrafts[student.id] ?? currentValue;
                    const isUnchanged = draftValue === currentValue;

                    return (
                      <tr className="border-t border-[#26150F]/10" key={student.id}>
                        <td className="px-3 py-3 font-medium text-[#0A0A0A]">{student.name}</td>
                        <td className="px-3 py-3 text-[#26150F]/80">{student.campusId}</td>
                        <td className="px-3 py-3 text-[#26150F]/80">{student.degreeProgram}</td>
                        <td className="px-3 py-3 text-[#26150F]/80">
                          Y{student.year} / S{student.semester}
                        </td>
                        <td className="px-3 py-3">
                          {student.group ? (
                            <Badge variant="neutral">{student.group}</Badge>
                          ) : (
                            <span className="text-xs text-[#26150F]/65">Unassigned</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex min-w-[240px] items-center gap-2">
                            <Select
                              className="h-9 py-1.5 text-xs"
                              onChange={(event) =>
                                setDraftGroup(student.id, event.target.value)
                              }
                              value={draftValue}
                            >
                              <option value="unassigned">Unassigned</option>
                              {groupOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </Select>
                            <Button
                              className="px-3 py-1.5 text-xs"
                              disabled={isUnchanged}
                              onClick={() =>
                                assignGroup(student.id, student.name, student.group)
                              }
                            >
                              Assign
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {tabStudents.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-[#26150F]/72">
                  No students assigned to {trackTitle(activeTab)} yet.
                </div>
              ) : null}
            </div>
          </div>
          <TablePagination
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value as PageSize);
              setPage(1);
            }}
            page={safePage}
            pageCount={pageCount}
            pageSize={pageSize}
            totalItems={tabStudents.length}
          />
        </Card>
      </div>
    </div>
  );
}

export default function StudentGroupingPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#26150F]/72">Loading grouping...</div>}>
      <StudentGroupingContent />
    </Suspense>
  );
}

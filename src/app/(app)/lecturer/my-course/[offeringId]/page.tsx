"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ExternalLink,
  FileText,
  FolderOpen,
  ListChecks,
  PencilLine,
  Save,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import Textarea from "@/components/ui/Textarea";
import { authHeaders } from "@/models/rbac";

type WeekResourceItem = { id: string; title: string; url: string; description: string };
type WeekAssignmentItem = { id: string; title: string; description: string; link: string };
type WeekTodoItem = { id: string; text: string };

type LecturerCourseWeek = {
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
};

type LecturerCourseDetailPayload = {
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
  weeks: LecturerCourseWeek[];
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDateOnly(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value || "TBA" : parsed.toLocaleDateString();
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value || "Unknown" : parsed.toLocaleString();
}

function serializeResourceLines(items: WeekResourceItem[]) {
  return items.map((item) => [item.title, item.url, item.description].filter(Boolean).join(" | ")).join("\n");
}

function serializeAssignmentLines(items: WeekAssignmentItem[]) {
  return items.map((item) => [item.title, item.description, item.link].filter(Boolean).join(" | ")).join("\n");
}

function serializeTodoLines(items: WeekTodoItem[]) {
  return items.map((item) => item.text).join("\n");
}

function toResourceRows(input: string) {
  return input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [titlePart, urlPart, descriptionPart] = line.split("|").map((item) => item.trim());
    return { id: `res-${index + 1}`, title: titlePart || urlPart || `Resource ${index + 1}`, url: urlPart || "", description: descriptionPart || "" };
  });
}

function toAssignmentRows(input: string) {
  return input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [titlePart, descriptionPart, linkPart] = line.split("|").map((item) => item.trim());
    return { id: `asg-${index + 1}`, title: titlePart || `Assignment ${index + 1}`, description: descriptionPart || "", link: linkPart || "" };
  });
}

function toTodoRows(input: string) {
  return input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((text, index) => ({ id: `todo-${index + 1}`, text }));
}

function weekStatus(week: LecturerCourseWeek) {
  if (week.isCurrent) return { label: "Current", className: "bg-[#034aa6]/10 text-[#034aa6] ring-1 ring-[#034aa6]/15" };
  if (week.isPast) return { label: "Completed", className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" };
  if (week.isFuture) return { label: "Upcoming", className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" };
  return { label: "Scheduled", className: "bg-slate-100 text-slate-700 ring-1 ring-slate-200" };
}

function resourceBadge(item: Pick<WeekResourceItem, "title" | "url">) {
  const source = `${item.title} ${item.url}`.toLowerCase();
  if (source.includes(".ppt") || source.includes(".pptx") || source.includes("slide")) return { label: "PPT", className: "bg-sky-500" };
  if (source.includes(".pdf")) return { label: "PDF", className: "bg-sky-500" };
  if (source.includes(".doc") || source.includes(".docx")) return { label: "DOC", className: "bg-emerald-500" };
  return { label: "LINK", className: "bg-slate-500" };
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-[28px] border border-border/80 bg-[#fafbff] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#034aa6] shadow-sm ring-1 ring-border/80">{icon}</div>
        <p className="text-sm font-semibold text-heading">{title}</p>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function LecturerCourseDetailPage() {
  const params = useParams<{ offeringId: string }>();
  const offeringId = String(params?.offeringId ?? "").trim();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [data, setData] = useState<LecturerCourseDetailPayload | null>(null);
  const [selectedWeekNo, setSelectedWeekNo] = useState(1);
  const [openWeekNo, setOpenWeekNo] = useState<number | null>(null);
  const [outline, setOutline] = useState("");
  const [slidesText, setSlidesText] = useState("");
  const [resourcesText, setResourcesText] = useState("");
  const [assignmentsText, setAssignmentsText] = useState("");
  const [todoText, setTodoText] = useState("");

  useEffect(() => {
    if (!offeringId) {
      setError("Module offering id is required.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const response = await fetch(`/api/lecturer/my-course/${encodeURIComponent(offeringId)}`, { cache: "no-store", headers: { ...authHeaders() } });
        const payload = (await response.json().catch(() => null)) as LecturerCourseDetailPayload | { message?: string } | null;
        if (!response.ok) {
          throw new Error(payload && typeof payload === "object" && "message" in payload ? payload.message || "Failed to load module detail." : "Failed to load module detail.");
        }
        if (!cancelled) {
          const normalized = payload as LecturerCourseDetailPayload;
          const initialWeekNo = normalized.offering.currentWeekNo ?? normalized.weeks[0]?.weekNo ?? 1;
          setData(normalized);
          setSelectedWeekNo(initialWeekNo);
          setOpenWeekNo(initialWeekNo);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Failed to load module detail.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [offeringId]);

  const selectedWeek = useMemo(() => data?.weeks.find((week) => week.weekNo === selectedWeekNo) ?? null, [data, selectedWeekNo]);
  const currentWeek = useMemo(() => data?.weeks.find((week) => week.isCurrent) ?? null, [data]);
  const totalEntries = useMemo(() => data?.weeks.reduce((sum, week) => sum + week.lectureSlides.length + week.resources.length + week.assignments.length + week.todoItems.length, 0) ?? 0, [data]);

  useEffect(() => {
    if (!selectedWeek) {
      setOutline("");
      setSlidesText("");
      setResourcesText("");
      setAssignmentsText("");
      setTodoText("");
      return;
    }
    setOutline(selectedWeek.outline || "");
    setSlidesText(serializeResourceLines(selectedWeek.lectureSlides));
    setResourcesText(serializeResourceLines(selectedWeek.resources));
    setAssignmentsText(serializeAssignmentLines(selectedWeek.assignments));
    setTodoText(serializeTodoLines(selectedWeek.todoItems));
  }, [selectedWeek]);

  const handleWeekSelection = (weekNo: number) => {
    setSelectedWeekNo(weekNo);
    setOpenWeekNo(weekNo);
    setSaveMessage("");
  };

  const saveWeekContent = async () => {
    if (!data || !selectedWeekNo || saving) return;
    setSaving(true);
    setSaveMessage("");
    try {
      const response = await fetch(`/api/lecturer/my-course/${encodeURIComponent(data.offering.id)}/week-content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ weekNo: selectedWeekNo, outline, lectureSlides: toResourceRows(slidesText), resources: toResourceRows(resourcesText), assignments: toAssignmentRows(assignmentsText), todoItems: toTodoRows(todoText) }),
      });
      const payload = (await response.json().catch(() => null)) as LecturerCourseDetailPayload | { message?: string; offering?: LecturerCourseDetailPayload["offering"]; weeks?: LecturerCourseWeek[] } | null;
      if (!response.ok) {
        throw new Error(payload && typeof payload === "object" && "message" in payload ? payload.message || "Failed to save week content." : "Failed to save week content.");
      }
      if (payload && typeof payload === "object" && "offering" in payload && "weeks" in payload) {
        setData({ offering: payload.offering as LecturerCourseDetailPayload["offering"], weeks: Array.isArray(payload.weeks) ? payload.weeks : [] });
      }
      setOpenWeekNo(selectedWeekNo);
      setSaveMessage(`Week ${selectedWeekNo} content saved.`);
    } catch (saveError) {
      setSaveMessage(saveError instanceof Error ? saveError.message : "Failed to save week content.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-7 w-52" /><Card><Skeleton className="h-16 w-full" /></Card></div>;
  }

  if (error) {
    return <Card className="border-red-200 bg-red-50"><h1 className="text-2xl font-semibold text-red-900">My Course</h1><p className="mt-2 text-sm text-red-800/85">{error}</p><div className="mt-4"><Link href="/lecturer/my-course"><Button variant="secondary">Back to My Course</Button></Link></div></Card>;
  }

  if (!data) {
    return <Card><p className="text-sm text-text/75">Module details are unavailable.</p></Card>;
  }

  return (
    <div className="space-y-6">
      <Card accent className="overflow-visible">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#034aa6]">Weekly content manager</p>
            <div>
              <h1 className="text-2xl font-semibold text-heading md:text-3xl">
                {data.offering.moduleCode} - {data.offering.moduleName}
              </h1>
              <p className="mt-2 text-sm text-text/75">
                {data.offering.intakeName} • {data.offering.termCode}
                {currentWeek ? ` • Active week: Week ${currentWeek.weekNo}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-full bg-[#034aa6]/10 px-3 py-1 text-xs font-medium text-[#034aa6]">{data.weeks.length} academic weeks</div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{totalEntries} content entries</div>
              <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Editing Week {selectedWeekNo}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/lecturer/my-course">
              <Button variant="secondary">Back to My Course</Button>
            </Link>
            <Button className="gap-2 bg-[#034aa6] text-white hover:bg-[#033d8a]" disabled={saving || !selectedWeek} onClick={() => { void saveWeekContent(); }}>
              <Save size={16} />
              {saving ? "Saving..." : `Save Week ${selectedWeekNo}`}
            </Button>
          </div>
        </div>
      </Card>

      {data.weeks.length === 0 ? (
        <Card>
          <p className="text-sm text-text/75">No academic weeks are available for this module yet.</p>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,420px)]">
          <div className="space-y-4">
            {data.weeks.map((week) => {
              const status = weekStatus(week);
              const isOpen = openWeekNo === week.weekNo;
              const isSelected = selectedWeekNo === week.weekNo;

              return (
                <Card
                  className={cn(
                    "overflow-hidden border-border/80 transition-colors",
                    week.isCurrent && "border-[#034aa6]/30 bg-[linear-gradient(135deg,rgba(3,74,166,0.08),rgba(255,255,255,1))]",
                    isSelected && "ring-2 ring-[#034aa6]/12"
                  )}
                  key={week.weekNo}
                >
                  <button className="flex w-full items-start gap-4 text-left" onClick={() => setOpenWeekNo(isOpen ? null : week.weekNo)} type="button">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                      {isOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                    </span>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-2xl font-semibold text-heading">
                            {formatDateOnly(week.startDate)} - {formatDateOnly(week.endDate)}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", status.className)}>
                              Week {week.weekNo} • {status.label}
                            </span>
                            {isSelected ? <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Editing</span> : null}
                          </div>
                        </div>

                        <div className="grid gap-2 text-xs text-text/65 sm:grid-cols-2">
                          <div className="rounded-2xl border border-border/80 bg-white px-3 py-2">
                            Slides {week.lectureSlides.length} • Resources {week.resources.length}
                          </div>
                          <div className="rounded-2xl border border-border/80 bg-white px-3 py-2">
                            Assignments {week.assignments.length} • Todo {week.todoItems.length}
                          </div>
                        </div>
                      </div>

                      <p className="text-sm text-text/70">
                        {week.outline || `Week ${week.weekNo} content has not been outlined yet.`}
                      </p>
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="mt-6 space-y-4 border-t border-border/70 pt-6">
                      <div className="rounded-[28px] border border-[#034aa6]/12 bg-[#034aa6]/5 p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#034aa6] shadow-sm ring-1 ring-[#034aa6]/10">
                            <FileText size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-heading">Week outline</p>
                            <p className="text-sm text-text/70">{week.outline || "No summary added for this academic week yet."}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <Section icon={<BookOpen size={18} />} title="Lecture slides">
                          {week.lectureSlides.length === 0 ? (
                            <p className="text-sm text-text/60">No lecture slides uploaded for this week.</p>
                          ) : (
                            <div className="space-y-3">
                              {week.lectureSlides.map((item) => {
                                const badge = resourceBadge(item);
                                return (
                                  <div className="flex items-start gap-4 rounded-[24px] border border-border/80 bg-white px-4 py-3" key={item.id}>
                                    <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold text-white", badge.className)}>{badge.label}</div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-base font-medium text-heading">{item.title || "Untitled resource"}</p>
                                      {item.description ? <p className="mt-1 text-sm text-text/70">{item.description}</p> : null}
                                      {item.url ? (
                                        <a className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-[#034aa6] hover:underline" href={item.url} rel="noreferrer" target="_blank">
                                          <ExternalLink size={14} />
                                          Open resource
                                        </a>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </Section>

                        <Section icon={<FolderOpen size={18} />} title="Module resources">
                          {week.resources.length === 0 ? (
                            <p className="text-sm text-text/60">No supporting resources added for this week.</p>
                          ) : (
                            <div className="space-y-3">
                              {week.resources.map((item) => {
                                const badge = resourceBadge(item);
                                return (
                                  <div className="flex items-start gap-4 rounded-[24px] border border-border/80 bg-white px-4 py-3" key={item.id}>
                                    <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold text-white", badge.className)}>{badge.label}</div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-base font-medium text-heading">{item.title || "Untitled resource"}</p>
                                      {item.description ? <p className="mt-1 text-sm text-text/70">{item.description}</p> : null}
                                      {item.url ? (
                                        <a className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-[#034aa6] hover:underline" href={item.url} rel="noreferrer" target="_blank">
                                          <ExternalLink size={14} />
                                          Open resource
                                        </a>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </Section>

                        <Section icon={<ClipboardList size={18} />} title="Assignments">
                          {week.assignments.length === 0 ? (
                            <p className="text-sm text-text/60">No assignments published for this week.</p>
                          ) : (
                            <div className="space-y-3">
                              {week.assignments.map((item) => (
                                <div className="flex items-start gap-4 rounded-[24px] border border-border/80 bg-white px-4 py-3" key={item.id}>
                                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-pink-500 text-sm font-semibold text-white">TASK</div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-base font-medium text-heading">{item.title}</p>
                                    <p className="mt-1 text-sm text-text/70">{item.description || "No assignment description added yet."}</p>
                                    {item.link ? (
                                      <a className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-[#034aa6] hover:underline" href={item.link} rel="noreferrer" target="_blank">
                                        <ExternalLink size={14} />
                                        Open submission link
                                      </a>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </Section>

                        <Section icon={<ListChecks size={18} />} title="Weekly todo">
                          {week.todoItems.length === 0 ? (
                            <p className="text-sm text-text/60">No weekly todo items added.</p>
                          ) : (
                            <div className="space-y-2.5">
                              {week.todoItems.map((item) => (
                                <div className="flex items-start gap-3 rounded-[20px] border border-border/80 bg-white px-4 py-3" key={item.id}>
                                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={18} />
                                  <p className="text-sm text-text/80">{item.text}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </Section>
                      </div>

                      <div className="flex flex-col gap-3 rounded-[24px] border border-border/80 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-text/70">
                          <span className="font-medium text-heading">Last updated:</span> {formatDateTime(week.updatedAt)}
                        </div>
                        <Button className="gap-2 self-start sm:self-auto" onClick={() => handleWeekSelection(week.weekNo)} variant={isSelected ? "primary" : "secondary"}>
                          <PencilLine size={16} />
                          {isSelected ? "Editing this week" : "Edit this week"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>

          <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <Card accent description="Update the selected week and keep the preview on the left aligned with what students will see." title="Week Editor">
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-text/65">Academic Week</label>
                  <Select className="h-11" onChange={(event) => handleWeekSelection(Number(event.target.value))} value={String(selectedWeekNo)}>
                    {data.weeks.map((week) => (
                      <option key={week.weekNo} value={week.weekNo}>
                        Week {week.weekNo}{week.isCurrent ? " (Current)" : ""}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="rounded-[24px] border border-border/80 bg-tint px-4 py-3 text-sm text-text/75">
                  <div className="flex items-center gap-2 text-heading">
                    <CalendarDays size={16} />
                    <span className="font-medium">
                      {selectedWeek ? `${formatDateOnly(selectedWeek.startDate)} - ${formatDateOnly(selectedWeek.endDate)}` : "Select a week to manage content."}
                    </span>
                  </div>
                  {selectedWeek ? <p className="mt-2 text-xs text-text/65">Status: {weekStatus(selectedWeek).label} • Last updated {formatDateTime(selectedWeek.updatedAt)}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-text/65">Module Outline</label>
                  <Input className="h-11" onChange={(event) => setOutline(event.target.value)} placeholder="Example: Week 3 - Lecture 3 and practical exercise" value={outline} />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-text/65">Lecture Slides</label>
                  <Textarea className="min-h-[116px]" onChange={(event) => setSlidesText(event.target.value)} placeholder="Lecture 3 Deck | https://example.com/slides/week-3 | Main lecture slides" value={slidesText} />
                  <p className="mt-1.5 text-xs text-text/55">One item per line: Title | URL | Description</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-text/65">Weekly Resources</label>
                  <Textarea className="min-h-[116px]" onChange={(event) => setResourcesText(event.target.value)} placeholder="Reading 3 | https://example.com/resource/week-3 | Extra reading" value={resourcesText} />
                  <p className="mt-1.5 text-xs text-text/55">One item per line: Title | URL | Description</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-text/65">Assignments</label>
                  <Textarea className="min-h-[116px]" onChange={(event) => setAssignmentsText(event.target.value)} placeholder="Worksheet 3 | Submit before next class | https://example.com/assignment/3" value={assignmentsText} />
                  <p className="mt-1.5 text-xs text-text/55">One item per line: Title | Description | Link</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-text/65">Weekly Todo</label>
                  <Textarea className="min-h-[116px]" onChange={(event) => setTodoText(event.target.value)} placeholder="Complete week 3 coding task" value={todoText} />
                  <p className="mt-1.5 text-xs text-text/55">One todo item per line.</p>
                </div>

                <div className="flex flex-col gap-3">
                  <Button className="h-11 gap-2 bg-[#034aa6] text-white hover:bg-[#033d8a]" disabled={saving || !selectedWeek} onClick={() => { void saveWeekContent(); }}>
                    <Save size={16} />
                    {saving ? "Saving..." : `Save Week ${selectedWeekNo}`}
                  </Button>
                  {saveMessage ? <p className="text-sm text-text/70">{saveMessage}</p> : null}
                </div>
              </div>
            </Card>

            <Card variant="subtle">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#034aa6] ring-1 ring-border/80">
                  <PencilLine size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-heading">Formatting guide</p>
                  <p className="text-sm text-text/70">Keep each entry on a new line so the week preview stays clean and readable.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm text-text/75">
                <div className="rounded-2xl border border-border/80 bg-white px-4 py-3">
                  <p className="font-medium text-heading">Slides / resources</p>
                  <p className="mt-1 font-mono text-xs text-text/65">Title | URL | Description</p>
                </div>
                <div className="rounded-2xl border border-border/80 bg-white px-4 py-3">
                  <p className="font-medium text-heading">Assignments</p>
                  <p className="mt-1 font-mono text-xs text-text/65">Title | Description | Link</p>
                </div>
                <div className="rounded-2xl border border-border/80 bg-white px-4 py-3">
                  <p className="font-medium text-heading">Todo items</p>
                  <p className="mt-1 font-mono text-xs text-text/65">One task per line</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

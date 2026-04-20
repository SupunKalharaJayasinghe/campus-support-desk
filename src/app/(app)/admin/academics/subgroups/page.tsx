"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  Building2,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  GitBranchPlus,
  GraduationCap,
  Loader2,
  Shuffle,
  Users,
  WandSparkles,
} from "lucide-react";
import { useAdminContext } from "@/components/admin/AdminContext";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/ToastProvider";

type TermCode =
  | "Y1S1"
  | "Y1S2"
  | "Y2S1"
  | "Y2S2"
  | "Y3S1"
  | "Y3S2"
  | "Y4S1"
  | "Y4S2";
type AllocationMode = "GROUP_COUNT" | "STUDENTS_PER_SUBGROUP";
type SummaryTone = "sky" | "teal" | "amber" | "green" | "rose" | "violet";

interface FacultyOption {
  code: string;
  name: string;
}

interface DegreeOption {
  code: string;
  name: string;
  facultyCode: string;
}

interface IntakeOption {
  id: string;
  name: string;
  currentTerm: TermCode;
}

interface DistributionItem {
  code: string;
  count: number;
  firstStudentId: string;
  lastStudentId: string;
}

interface DistributionSummaryItem {
  code: string;
  count: number;
}

interface AllocationPreview {
  intake: {
    id: string;
    name: string;
    currentTerm: TermCode;
  };
  selectedTerm: TermCode | null;
  termMatchesCurrent: boolean;
  mode: AllocationMode;
  requestedSubgroupCount: number | null;
  requestedStudentsPerSubgroup: number | null;
  totalStudents: number;
  totalSubgroups: number;
  currentDistribution: DistributionSummaryItem[];
  previewDistribution: DistributionItem[];
  changedCount: number;
  unchangedCount: number;
  applied: boolean;
}

const TERM_OPTIONS: TermCode[] = [
  "Y1S1",
  "Y1S2",
  "Y2S1",
  "Y2S2",
  "Y3S1",
  "Y3S2",
  "Y4S1",
  "Y4S2",
];

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function parseTermCode(value: unknown): TermCode | null {
  const code = String(value ?? "").trim().toUpperCase();
  if (!code) {
    return null;
  }

  return TERM_OPTIONS.find((item) => item === code) ?? null;
}

function toPositiveInteger(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const whole = Math.floor(parsed);
  if (whole < 1) {
    return null;
  }

  return whole;
}

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | T
    | { message?: string }
    | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? payload.message
        : "Request failed";
    throw new Error(message || "Request failed");
  }

  return (payload ?? ({} as T)) as T;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  value: string;
  detail: string;
  tone: SummaryTone;
}) {
  return (
    <Card accent className="admin-stat-card h-full p-5" data-tone={tone}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-heading">{value}</p>
        </div>
        <span className="admin-stat-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-current">
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-4 text-xs text-text/60">{detail}</p>
    </Card>
  );
}

function parseIntakes(payload: unknown) {
  const root = asObject(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];

  return rows
    .map((row) => {
      const item = asObject(row);
      if (!item) {
        return null;
      }

      const id = String(item.id ?? item._id ?? "").trim();
      const currentTerm = parseTermCode(item.currentTerm);
      if (!id || !currentTerm) {
        return null;
      }

      return {
        id,
        name: collapseSpaces(item.name) || id,
        currentTerm,
      } satisfies IntakeOption;
    })
    .filter((item): item is IntakeOption => Boolean(item));
}

function parseFaculties(payload: unknown) {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((row) => {
      const item = asObject(row);
      if (!item) {
        return null;
      }

      const code = normalizeAcademicCode(item.code);
      if (!code) {
        return null;
      }

      return {
        code,
        name: collapseSpaces(item.name) || code,
      } satisfies FacultyOption;
    })
    .filter((item): item is FacultyOption => Boolean(item));
}

function parseDegrees(payload: unknown) {
  const root = asObject(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];

  return rows
    .map((row) => {
      const item = asObject(row);
      if (!item) {
        return null;
      }

      const code = normalizeAcademicCode(item.code ?? item.id);
      const facultyCode = normalizeAcademicCode(item.facultyCode);
      if (!code || !facultyCode) {
        return null;
      }

      return {
        code,
        name: collapseSpaces(item.name) || code,
        facultyCode,
      } satisfies DegreeOption;
    })
    .filter((item): item is DegreeOption => Boolean(item));
}

function parseDistributionSummary(
  value: unknown
): DistributionSummaryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => {
      const item = asObject(row);
      if (!item) {
        return null;
      }

      const code = collapseSpaces(item.code);
      if (!code) {
        return null;
      }

      return {
        code,
        count: Math.max(0, Number(item.count) || 0),
      } satisfies DistributionSummaryItem;
    })
    .filter((item): item is DistributionSummaryItem => Boolean(item));
}

function parseDistributionItems(value: unknown): DistributionItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => {
      const item = asObject(row);
      if (!item) {
        return null;
      }

      const code = collapseSpaces(item.code);
      if (!code) {
        return null;
      }

      return {
        code,
        count: Math.max(0, Number(item.count) || 0),
        firstStudentId: collapseSpaces(item.firstStudentId),
        lastStudentId: collapseSpaces(item.lastStudentId),
      } satisfies DistributionItem;
    })
    .filter((item): item is DistributionItem => Boolean(item));
}

function parseAllocationPreview(payload: unknown): AllocationPreview | null {
  const root = asObject(payload);
  const intake = asObject(root?.intake);
  if (!root || !intake) {
    return null;
  }

  const intakeId = String(intake.id ?? "").trim();
  const intakeName = collapseSpaces(intake.name);
  const intakeCurrentTerm = parseTermCode(intake.currentTerm);
  if (!intakeId || !intakeCurrentTerm) {
    return null;
  }

  const mode: AllocationMode =
    root.mode === "STUDENTS_PER_SUBGROUP"
      ? "STUDENTS_PER_SUBGROUP"
      : "GROUP_COUNT";

  return {
    intake: {
      id: intakeId,
      name: intakeName || intakeId,
      currentTerm: intakeCurrentTerm,
    },
    selectedTerm: parseTermCode(root.selectedTerm),
    termMatchesCurrent: root.termMatchesCurrent !== false,
    mode,
    requestedSubgroupCount:
      root.requestedSubgroupCount === null
        ? null
        : Math.max(0, Number(root.requestedSubgroupCount) || 0),
    requestedStudentsPerSubgroup:
      root.requestedStudentsPerSubgroup === null
        ? null
        : Math.max(0, Number(root.requestedStudentsPerSubgroup) || 0),
    totalStudents: Math.max(0, Number(root.totalStudents) || 0),
    totalSubgroups: Math.max(0, Number(root.totalSubgroups) || 0),
    currentDistribution: parseDistributionSummary(root.currentDistribution),
    previewDistribution: parseDistributionItems(root.previewDistribution),
    changedCount: Math.max(0, Number(root.changedCount) || 0),
    unchangedCount: Math.max(0, Number(root.unchangedCount) || 0),
    applied: root.applied === true,
  };
}

export default function SubgroupsPage() {
  const { toast } = useToast();
  const { setActiveWindow } = useAdminContext();

  const [faculties, setFaculties] = useState<FacultyOption[]>([]);
  const [degrees, setDegrees] = useState<DegreeOption[]>([]);
  const [selectedFaculty, setSelectedFaculty] = useState("");
  const [selectedDegree, setSelectedDegree] = useState("");
  const [isLoadingFaculties, setIsLoadingFaculties] = useState(true);
  const [isLoadingDegrees, setIsLoadingDegrees] = useState(false);
  const [intakes, setIntakes] = useState<IntakeOption[]>([]);
  const [isLoadingIntakes, setIsLoadingIntakes] = useState(true);
  const [selectedIntakeId, setSelectedIntakeId] = useState("");
  const [selectedTerm, setSelectedTerm] = useState<TermCode>("Y1S1");
  const [mode, setMode] = useState<AllocationMode>("GROUP_COUNT");
  const [subgroupCountInput, setSubgroupCountInput] = useState("10");
  const [studentsPerSubgroupInput, setStudentsPerSubgroupInput] = useState("60");
  const [headcount, setHeadcount] = useState<number | null>(null);
  const [isLoadingHeadcount, setIsLoadingHeadcount] = useState(false);
  const [preview, setPreview] = useState<AllocationPreview | null>(null);
  const [isRunningPreview, setIsRunningPreview] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const headcountRequestIdRef = useRef(0);
  const selectedIntake = useMemo(
    () => intakes.find((item) => item.id === selectedIntakeId) ?? null,
    [intakes, selectedIntakeId]
  );
  const selectedFacultyOption = useMemo(
    () => faculties.find((item) => item.code === selectedFaculty) ?? null,
    [faculties, selectedFaculty]
  );
  const selectedDegreeOption = useMemo(
    () => degrees.find((item) => item.code === selectedDegree) ?? null,
    [degrees, selectedDegree]
  );
  const parsedSubgroupCount = toPositiveInteger(subgroupCountInput);
  const parsedStudentsPerSubgroup = toPositiveInteger(studentsPerSubgroupInput);
  const activeAllocationInput =
    mode === "GROUP_COUNT" ? subgroupCountInput : studentsPerSubgroupInput;
  const totalStudentsValue = preview?.totalStudents ?? headcount ?? 0;
  const plannedSubgroupsValue = preview?.totalSubgroups ?? 0;
  const changedStudentsValue = preview?.changedCount ?? 0;
  const unchangedStudentsValue = preview?.unchangedCount ?? 0;
  const summaryCards: Array<{
    label: string;
    value: string;
    detail: string;
    tone: SummaryTone;
    icon: ComponentType<{ size?: number }>;
  }> = [
    {
      label: "Total Students",
      value: String(totalStudentsValue),
      detail:
        headcount === null && !preview
          ? "Student count will appear after intake selection"
          : "Filtered intake headcount for the selected term",
      tone: "sky",
      icon: Users,
    },
    {
      label: "Planned Subgroups",
      value: String(plannedSubgroupsValue),
      detail:
        preview?.mode === "STUDENTS_PER_SUBGROUP"
          ? "Calculated from the requested student count per subgroup"
          : "Calculated from the requested subgroup count",
      tone: "violet",
      icon: GitBranchPlus,
    },
    {
      label: "Students To Change",
      value: String(changedStudentsValue),
      detail:
        preview
          ? "Students that will receive a different subgroup assignment"
          : "Run preview to estimate how many records will change",
      tone: "amber",
      icon: Shuffle,
    },
    {
      label: "Unchanged Students",
      value: String(unchangedStudentsValue),
      detail:
        preview
          ? "Students that will keep their current subgroup value"
          : "Unchanged count is shown after preview",
      tone: "green",
      icon: CheckCircle2,
    },
  ];

  const validationError = useMemo(() => {
    if (!selectedFaculty) {
      return "Select a faculty";
    }

    if (!selectedDegree) {
      return "Select a degree";
    }

    if (!selectedIntakeId) {
      return "Select an intake";
    }

    if (mode === "GROUP_COUNT" && !parsedSubgroupCount) {
      return "Enter a valid subgroup count";
    }

    if (mode === "STUDENTS_PER_SUBGROUP" && !parsedStudentsPerSubgroup) {
      return "Enter a valid student count per subgroup";
    }

    return "";
  }, [
    mode,
    parsedStudentsPerSubgroup,
    parsedSubgroupCount,
    selectedDegree,
    selectedFaculty,
    selectedIntakeId,
  ]);

  const executeAllocation = useCallback(
    async (apply: boolean) => {
      if (validationError) {
        toast({
          title: "Invalid input",
          message: validationError,
          variant: "error",
        });
        return;
      }

      const body = {
        intakeId: selectedIntakeId,
        termCode: selectedTerm,
        mode,
        subgroupCount: mode === "GROUP_COUNT" ? parsedSubgroupCount : undefined,
        studentsPerSubgroup:
          mode === "STUDENTS_PER_SUBGROUP" ? parsedStudentsPerSubgroup : undefined,
        apply,
      };

      try {
        if (apply) {
          setIsApplying(true);
        } else {
          setIsRunningPreview(true);
        }

        const response = await fetch("/api/subgroups/auto-assign", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const parsed = parseAllocationPreview(
          await readJson<unknown>(response)
        );
        if (!parsed) {
          throw new Error("Failed to read subgroup allocation response");
        }

        setPreview(parsed);
        setHeadcount(parsed.totalStudents);
        if (mode === "STUDENTS_PER_SUBGROUP") {
          setSubgroupCountInput(String(parsed.totalSubgroups));
        } else if (mode === "GROUP_COUNT") {
          const maxStudentsInGroup = parsed.previewDistribution.reduce(
            (max, item) => Math.max(max, item.count),
            0
          );
          if (maxStudentsInGroup > 0) {
            setStudentsPerSubgroupInput(String(maxStudentsInGroup));
          }
        }

        if (apply) {
          toast({
            title: "Subgroups assigned",
            message: `${parsed.changedCount} students moved to new subgroup slots.`,
            variant: "success",
          });
        } else {
          toast({
            title: "Preview ready",
            message: `${parsed.totalStudents} students mapped into ${parsed.totalSubgroups} subgroup slots.`,
            variant: "info",
          });
        }
      } catch (error) {
        toast({
          title: "Failed",
          message:
            error instanceof Error
              ? error.message
              : "Failed to run subgroup allocation",
          variant: "error",
        });
      } finally {
        if (apply) {
          setIsApplying(false);
        } else {
          setIsRunningPreview(false);
        }
      }
    },
    [
      mode,
      parsedStudentsPerSubgroup,
      parsedSubgroupCount,
      selectedIntakeId,
      selectedTerm,
      toast,
      validationError,
    ]
  );

  useEffect(() => {
    setActiveWindow("Allocation");
    return () => setActiveWindow(null);
  }, [setActiveWindow]);

  useEffect(() => {
    let mounted = true;
    setIsLoadingFaculties(true);

    void (async () => {
      try {
        const nextFaculties = parseFaculties(
          await readJson<unknown>(
            await fetch("/api/faculties", {
              cache: "no-store",
            })
          )
        );
        if (!mounted) {
          return;
        }

        setFaculties(nextFaculties);
        setSelectedFaculty((previous) =>
          previous && nextFaculties.some((item) => item.code === previous)
            ? previous
            : nextFaculties[0]?.code ?? ""
        );
      } catch {
        if (!mounted) {
          return;
        }

        setFaculties([]);
        setSelectedFaculty("");
      } finally {
        if (mounted) {
          setIsLoadingFaculties(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedFaculty) {
      setDegrees([]);
      setSelectedDegree("");
      return;
    }

    let mounted = true;
    setIsLoadingDegrees(true);

    void (async () => {
      try {
        const params = new URLSearchParams({
          facultyId: selectedFaculty,
          status: "ACTIVE",
        });
        const nextDegrees = parseDegrees(
          await readJson<unknown>(
            await fetch(`/api/degrees?${params.toString()}`, {
              cache: "no-store",
            })
          )
        ).filter((item) => item.facultyCode === selectedFaculty);

        if (!mounted) {
          return;
        }

        setDegrees(nextDegrees);
        setSelectedDegree((previous) =>
          previous && nextDegrees.some((item) => item.code === previous)
            ? previous
            : nextDegrees[0]?.code ?? ""
        );
      } catch {
        if (!mounted) {
          return;
        }

        setDegrees([]);
        setSelectedDegree("");
      } finally {
        if (!mounted) {
          return;
        }

        setIsLoadingDegrees(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedFaculty]);

  useEffect(() => {
    if (!selectedFaculty || !selectedDegree) {
      setIntakes([]);
      setSelectedIntakeId("");
      setIsLoadingIntakes(false);
      return;
    }

    let mounted = true;
    setIsLoadingIntakes(true);

    void (async () => {
      try {
        const params = new URLSearchParams({
          page: "1",
          pageSize: "100",
          sort: "az",
          status: "ACTIVE",
          facultyId: selectedFaculty,
          degreeProgramId: selectedDegree,
        });
        const nextIntakes = parseIntakes(
          await readJson<unknown>(
            await fetch(`/api/intakes?${params.toString()}`, {
              cache: "no-store",
            })
          )
        );
        if (!mounted) {
          return;
        }

        setIntakes(nextIntakes);
        if (nextIntakes.length > 0) {
          const fallback = nextIntakes[0];
          setSelectedIntakeId((previous) =>
            previous && nextIntakes.some((item) => item.id === previous)
              ? previous
              : fallback.id
          );
          setSelectedTerm(fallback.currentTerm);
        } else {
          setSelectedIntakeId("");
        }
      } catch {
        if (!mounted) {
          return;
        }

        setIntakes([]);
        setSelectedIntakeId("");
      } finally {
        if (mounted) {
          setIsLoadingIntakes(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedDegree, selectedFaculty]);

  useEffect(() => {
    if (!selectedIntakeId || !selectedIntake) {
      setHeadcount(null);
      return;
    }

    setSelectedTerm(selectedIntake.currentTerm);
  }, [selectedIntake, selectedIntakeId]);

  useEffect(() => {
    if (!selectedIntakeId) {
      setHeadcount(null);
      return;
    }

    const requestId = headcountRequestIdRef.current + 1;
    headcountRequestIdRef.current = requestId;
    setIsLoadingHeadcount(true);

    void (async () => {
      try {
        const payload = await readJson<unknown>(
          await fetch("/api/subgroups/auto-assign", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              intakeId: selectedIntakeId,
              termCode: selectedTerm,
              mode: "GROUP_COUNT",
              subgroupCount: 1,
              apply: false,
            }),
          })
        );

        if (headcountRequestIdRef.current !== requestId) {
          return;
        }

        const parsed = parseAllocationPreview(payload);
        setHeadcount(parsed ? parsed.totalStudents : null);
      } catch {
        if (headcountRequestIdRef.current === requestId) {
          setHeadcount(null);
        }
      } finally {
        if (headcountRequestIdRef.current === requestId) {
          setIsLoadingHeadcount(false);
        }
      }
    })();
  }, [selectedIntakeId, selectedTerm]);

  useEffect(() => {
    setPreview(null);
  }, [
    activeAllocationInput,
    mode,
    selectedDegree,
    selectedFaculty,
    selectedIntakeId,
    selectedTerm,
  ]);

  return (
    <div className="admin-dashboard space-y-6 lg:space-y-8">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          className="h-11 min-w-[140px] gap-2 px-5"
          disabled={Boolean(validationError) || isRunningPreview || isApplying}
          onClick={() => {
            void executeAllocation(false);
          }}
        >
          {isRunningPreview ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <WandSparkles size={16} />
          )}
          Preview
        </Button>
        <Button
          className="h-11 min-w-[180px] gap-2 border-emerald-200 bg-emerald-500 px-5 text-white shadow-[0_12px_28px_rgba(16,185,129,0.18)] hover:bg-emerald-600"
          disabled={
            Boolean(validationError) ||
            isRunningPreview ||
            isApplying ||
            !preview ||
            preview.totalStudents === 0
          }
          onClick={() => {
            void executeAllocation(true);
          }}
        >
          {isApplying ? <Loader2 className="animate-spin" size={16} /> : null}
          Create Subgroups
        </Button>
        <Badge variant="neutral">Selected Term: {selectedTerm}</Badge>
        {preview ? (
          <Badge variant={preview.applied ? "success" : "primary"}>
            {preview.applied ? "Allocation Applied" : "Preview Ready"}
          </Badge>
        ) : null}
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)] xl:items-start">
        <div className="grid gap-4">
          <Card accent className="p-6 lg:p-7">
            <div className="grid gap-6">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(240px,300px)] xl:items-start">
                <div className="max-w-2xl">
                  <Badge variant="neutral">Academic Structure</Badge>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                    Subgroup allocation planner
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-text/68">
                    Split intake students into subgroup codes such as 1.1, 1.2, 2.1, and
                    2.2 using an even distribution or a fixed-size allocation rule.
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">
                      Faculty {selectedFacultyOption?.code ?? "-"}
                    </Badge>
                    <Badge variant="neutral">
                      Degree {selectedDegreeOption?.code ?? "-"}
                    </Badge>
                    <Badge variant="neutral">Intake {selectedIntake?.name ?? "-"}</Badge>
                  </div>
                </div>

                <div className="admin-inline-stat rounded-[24px] border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                    Filtered Intake Student Count
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-heading">
                    {isLoadingHeadcount ? "..." : headcount ?? 0}
                  </p>
                  <p className="mt-1 text-sm text-text/60">
                    {selectedIntake
                      ? `Current intake term ${selectedIntake.currentTerm}`
                      : "Select a faculty, degree, and intake to load counts"}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    Faculty
                  </label>
                  <div className="group relative flex h-14 w-full items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                    <span className="mr-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Building2 size={16} />
                    </span>
                    <select
                      className="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent pr-8 text-[15px] text-heading outline-none"
                      disabled={isLoadingFaculties}
                      onChange={(event) => {
                        setSelectedFaculty(normalizeAcademicCode(event.target.value));
                      }}
                      value={selectedFaculty}
                    >
                      <option value="">
                        {isLoadingFaculties ? "Loading faculties..." : "Select faculty"}
                      </option>
                      {faculties.map((faculty) => (
                        <option key={faculty.code} value={faculty.code}>
                          {faculty.code} - {faculty.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text/45"
                      size={17}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    Degree
                  </label>
                  <div className="group relative flex h-14 w-full items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                    <span className="mr-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <GraduationCap size={16} />
                    </span>
                    <select
                      className="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent pr-8 text-[15px] text-heading outline-none"
                      disabled={!selectedFaculty || isLoadingDegrees}
                      onChange={(event) => {
                        setSelectedDegree(normalizeAcademicCode(event.target.value));
                      }}
                      value={selectedDegree}
                    >
                      <option value="">
                        {!selectedFaculty
                          ? "Select faculty first"
                          : isLoadingDegrees
                            ? "Loading degrees..."
                            : "Select degree"}
                      </option>
                      {degrees.map((degree) => (
                        <option key={degree.code} value={degree.code}>
                          {degree.code} - {degree.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text/45"
                      size={17}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    Intake
                  </label>
                  <div className="group relative flex h-14 w-full items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                    <span className="mr-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Users size={16} />
                    </span>
                    <select
                      className="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent pr-8 text-[15px] text-heading outline-none"
                      disabled={!selectedDegree || isLoadingIntakes}
                      onChange={(event) =>
                        setSelectedIntakeId(String(event.target.value ?? "").trim())
                      }
                      value={selectedIntakeId}
                    >
                      <option value="">
                        {!selectedDegree
                          ? "Select degree first"
                          : isLoadingIntakes
                            ? "Loading intakes..."
                            : "Select intake"}
                      </option>
                      {intakes.map((intake) => (
                        <option key={intake.id} value={intake.id}>
                          {intake.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text/45"
                      size={17}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    Semester
                  </label>
                  <div className="group relative flex h-14 w-full items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                    <span className="mr-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <CalendarRange size={16} />
                    </span>
                    <select
                      className="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent pr-8 text-[15px] text-heading outline-none"
                      disabled={!selectedIntakeId}
                      onChange={(event) => {
                        const nextTerm = parseTermCode(event.target.value);
                        if (nextTerm) {
                          setSelectedTerm(nextTerm);
                        }
                      }}
                      value={selectedTerm}
                    >
                      {TERM_OPTIONS.map((term) => (
                        <option key={term} value={term}>
                          {term}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text/45"
                      size={17}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 lg:p-7">
            <div className="grid gap-5">
              <div>
                <Badge variant="neutral">Allocation Rules</Badge>
                <p className="mt-3 text-lg font-semibold text-heading">
                  Configure subgroup sizing
                </p>
                <p className="mt-1 text-sm text-text/65">
                  Choose whether to divide students by a target subgroup count or a fixed
                  number of students per subgroup before generating the preview.
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    Allocation Mode
                  </label>
                  <div className="group relative flex h-14 w-full items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                    <span className="mr-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Shuffle size={16} />
                    </span>
                    <select
                      className="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent pr-8 text-[15px] text-heading outline-none"
                      onChange={(event) => {
                        const nextMode =
                          event.target.value === "STUDENTS_PER_SUBGROUP"
                            ? "STUDENTS_PER_SUBGROUP"
                            : "GROUP_COUNT";
                        setMode(nextMode);
                      }}
                      value={mode}
                    >
                      <option value="GROUP_COUNT">Split by subgroup count</option>
                      <option value="STUDENTS_PER_SUBGROUP">
                        Split by students per subgroup
                      </option>
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text/45"
                      size={17}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    Students Per Subgroup
                  </label>
                  <div
                    className={cn(
                      "group flex h-14 w-full items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]",
                      mode !== "STUDENTS_PER_SUBGROUP" && "opacity-60"
                    )}
                  >
                    <span className="mr-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Users size={16} />
                    </span>
                    <input
                      className="h-full min-w-0 flex-1 border-0 bg-transparent pr-2 text-[15px] text-heading outline-none placeholder:text-text/48"
                      disabled={mode !== "STUDENTS_PER_SUBGROUP"}
                      min={1}
                      onChange={(event) => setStudentsPerSubgroupInput(event.target.value)}
                      placeholder="60"
                      type="number"
                      value={studentsPerSubgroupInput}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    Subgroup Count
                  </label>
                  <div
                    className={cn(
                      "group flex h-14 w-full items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]",
                      mode !== "GROUP_COUNT" && "opacity-60"
                    )}
                  >
                    <span className="mr-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <GitBranchPlus size={16} />
                    </span>
                    <input
                      className="h-full min-w-0 flex-1 border-0 bg-transparent pr-2 text-[15px] text-heading outline-none placeholder:text-text/48"
                      disabled={mode !== "GROUP_COUNT"}
                      min={1}
                      onChange={(event) => setSubgroupCountInput(event.target.value)}
                      placeholder="10"
                      type="number"
                      value={subgroupCountInput}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral">
                  Current Intake Term: {selectedIntake?.currentTerm ?? "-"}
                </Badge>
                {preview && !preview.termMatchesCurrent ? (
                  <Badge variant="warning">
                    Selected semester differs from intake current term
                  </Badge>
                ) : null}
              </div>

              {validationError ? (
                <p className="text-sm font-medium text-primary">{validationError}</p>
              ) : (
                <p className="text-sm text-text/60">
                  Preview shows the new subgroup distribution before the assignment is
                  applied.
                </p>
              )}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {summaryCards.map((item) => (
            <SummaryCard
              detail={item.detail}
              icon={item.icon}
              key={item.label}
              label={item.label}
              tone={item.tone}
              value={item.value}
            />
          ))}
        </div>
      </section>

      <Card className="overflow-hidden p-0 transition-all">
        <div className="flex flex-col gap-4 border-b border-border px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-lg font-semibold text-heading">Subgroup Allocation Preview</p>
            <p className="mt-1 text-sm text-text/68">
              Review the current distribution and compare it against the planned subgroup
              allocation before applying changes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {mode === "GROUP_COUNT"
                ? `Requested groups: ${parsedSubgroupCount ?? 0}`
                : `Requested size: ${parsedStudentsPerSubgroup ?? 0}`}
            </Badge>
            <Badge variant="neutral">Selected Term: {selectedTerm}</Badge>
            {preview ? (
              <Badge variant={preview.applied ? "success" : "primary"}>
                {preview.applied ? "Applied" : "Preview Loaded"}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6 sm:py-6">
          {preview ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.4fr)]">
              <div className="rounded-[28px] border border-border bg-white/82 p-5 shadow-[0_16px_32px_rgba(15,23,41,0.06)]">
                <p className="text-lg font-semibold text-heading">
                  Current Subgroup Distribution
                </p>
                <p className="mt-1 text-sm text-text/65">
                  Existing subgroup values for the selected intake before applying the new
                  allocation.
                </p>
                <div className="mt-4 space-y-2">
                  {preview.currentDistribution.length === 0 ? (
                    <p className="text-sm text-text/65">No subgroup values assigned yet.</p>
                  ) : (
                    preview.currentDistribution.map((item) => (
                      <div
                        className="flex items-center justify-between rounded-[20px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(247,249,253,0.9)_100%)] px-4 py-3 text-sm shadow-[0_8px_20px_rgba(15,23,41,0.04)]"
                        key={item.code}
                      >
                        <span className="font-semibold text-heading">{item.code}</span>
                        <Badge variant="neutral">{item.count}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-border bg-white/82 shadow-[0_16px_32px_rgba(15,23,41,0.06)]">
                <div className="border-b border-border px-5 py-5">
                  <p className="text-lg font-semibold text-heading">
                    New Subgroup Allocation Preview
                  </p>
                  <p className="mt-1 text-sm text-text/65">
                    Proposed subgroup ranges for the selected intake and semester.
                  </p>
                </div>
                <div className="max-h-[460px] overflow-y-auto overflow-x-auto px-4 py-4 sm:px-5 sm:py-5">
                  <div className="overflow-hidden rounded-[24px] border border-border bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="bg-[rgba(255,255,255,0.82)]">
                        <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                          <th className="px-4 py-4">Subgroup</th>
                          <th className="px-4 py-4">Students</th>
                          <th className="px-4 py-4">Range</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/70">
                        {preview.previewDistribution.map((item) => (
                          <tr className="transition-colors duration-200 hover:bg-white/70" key={item.code}>
                            <td className="px-4 py-4 font-semibold text-heading">{item.code}</td>
                            <td className="px-4 py-4 text-text/78">{item.count}</td>
                            <td className="px-4 py-4 text-text/70">
                              {item.count === 0
                                ? "-"
                                : `${item.firstStudentId || "-"} to ${item.lastStudentId || "-"}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-border bg-white/60 px-6 py-12 text-center shadow-[0_10px_28px_rgba(15,23,41,0.04)]">
              <p className="text-lg font-semibold text-heading">Preview not generated yet</p>
              <p className="mt-2 text-sm text-text/68">
                Run preview to see how students will be assigned. Example order: 1.1,
                1.2, 2.1, 2.2.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

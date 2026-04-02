"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, WandSparkles } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import { useAdminContext } from "@/components/admin/AdminContext";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
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

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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
  const parsedSubgroupCount = toPositiveInteger(subgroupCountInput);
  const parsedStudentsPerSubgroup = toPositiveInteger(studentsPerSubgroupInput);

  const validationError = useMemo(() => {
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
    setIsLoadingIntakes(true);

    void (async () => {
      try {
        const payload = await readJson<unknown>(
          await fetch("/api/intakes?page=1&pageSize=100&sort=az&status=ACTIVE", {
            cache: "no-store",
          })
        );
        const nextIntakes = parseIntakes(payload);
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
  }, []);

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

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="Subgroups"
        description="Split intake students into subgroup codes such as 1.1, 1.2, 2.1 with an even or fixed-size allocation rule."
      />

      <Card accent>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
              Intake
            </label>
            <Select
              className="h-12"
              disabled={isLoadingIntakes}
              onChange={(event) => setSelectedIntakeId(String(event.target.value ?? "").trim())}
              value={selectedIntakeId}
            >
              <option value="">
                {isLoadingIntakes ? "Loading intakes..." : "Select intake"}
              </option>
              {intakes.map((intake) => (
                <option key={intake.id} value={intake.id}>
                  {intake.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
              Semester
            </label>
            <Select
              className="h-12"
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
            </Select>
          </div>

          <div className="rounded-2xl border border-border bg-tint px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
              Intake Student Count
            </p>
            <p className="mt-2 text-2xl font-semibold text-heading">
              {isLoadingHeadcount ? "..." : headcount ?? 0}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="neutral">
                Current Term: {selectedIntake?.currentTerm ?? "-"}
              </Badge>
              {preview && !preview.termMatchesCurrent ? (
                <Badge variant="warning">
                  Selected semester differs from intake current term
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
              Allocation Mode
            </label>
            <Select
              className="h-12"
              onChange={(event) => {
                const nextMode =
                  event.target.value === "STUDENTS_PER_SUBGROUP"
                    ? "STUDENTS_PER_SUBGROUP"
                    : "GROUP_COUNT";
                setMode(nextMode);
              }}
              value={mode}
            >
              <option value="GROUP_COUNT">Split By Subgroup Count</option>
              <option value="STUDENTS_PER_SUBGROUP">Split By Students Per Subgroup</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
              Subgroup Count
            </label>
            <Input
              className="h-12"
              disabled={mode !== "GROUP_COUNT"}
              min={1}
              onChange={(event) => setSubgroupCountInput(event.target.value)}
              placeholder="10"
              type="number"
              value={subgroupCountInput}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
              Students Per Subgroup
            </label>
            <Input
              className="h-12"
              disabled={mode !== "STUDENTS_PER_SUBGROUP"}
              min={1}
              onChange={(event) => setStudentsPerSubgroupInput(event.target.value)}
              placeholder="60"
              type="number"
              value={studentsPerSubgroupInput}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className="h-12 min-w-[150px] gap-2 bg-[#034aa6] px-5 text-white hover:bg-[#0339a6]"
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
              className="h-12 min-w-[150px] gap-2 bg-[#0f766e] px-5 text-white hover:bg-[#0b5f58]"
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
              Assign Subgroups
            </Button>
          </div>
        </div>

        {validationError ? (
          <p className="mt-3 text-sm font-medium text-[#0339A6]">{validationError}</p>
        ) : null}
      </Card>

      <Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-tint px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
              Total Students
            </p>
            <p className="mt-2 text-2xl font-semibold text-heading">
              {preview?.totalStudents ?? headcount ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-tint px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
              Planned Subgroups
            </p>
            <p className="mt-2 text-2xl font-semibold text-heading">
              {preview?.totalSubgroups ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-tint px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
              Students To Change
            </p>
            <p className="mt-2 text-2xl font-semibold text-heading">
              {preview?.changedCount ?? 0}
            </p>
          </div>
        </div>

        {preview ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="text-sm font-semibold text-heading">
                Current Subgroup Distribution
              </p>
              <div className="mt-3 space-y-2">
                {preview.currentDistribution.length === 0 ? (
                  <p className="text-sm text-text/65">No subgroup values assigned yet.</p>
                ) : (
                  preview.currentDistribution.map((item) => (
                    <div
                      className="flex items-center justify-between rounded-xl border border-border bg-tint px-3 py-2 text-sm"
                      key={item.code}
                    >
                      <span className="font-semibold text-heading">{item.code}</span>
                      <Badge variant="neutral">{item.count}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="text-sm font-semibold text-heading">
                New Subgroup Allocation Preview
              </p>
              <div className="mt-3 max-h-[420px] overflow-y-auto pr-1">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase tracking-[0.08em] text-text/60">
                    <tr>
                      <th className="px-2 py-2">Subgroup</th>
                      <th className="px-2 py-2">Students</th>
                      <th className="px-2 py-2">Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.previewDistribution.map((item) => (
                      <tr className="border-b border-border/70" key={item.code}>
                        <td className="px-2 py-2 font-semibold text-heading">{item.code}</td>
                        <td className="px-2 py-2">{item.count}</td>
                        <td className="px-2 py-2 text-text/70">
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
        ) : (
          <p className="mt-5 text-sm text-text/68">
            Run preview to see how students will be assigned (example order: 1.1, 1.2, 2.1, 2.2).
          </p>
        )}
      </Card>
    </div>
  );
}

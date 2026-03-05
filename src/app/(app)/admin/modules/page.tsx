"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, RefreshCcw, Save, X } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
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

type SyllabusVersion = "OLD" | "NEW";

interface ModuleOutlineTemplateItem {
  weekNo: number;
  title: string;
  type?: "LECTURE" | "MID" | "QUIZ" | "LAB" | "OTHER";
}

interface ModuleRecord {
  id: string;
  code: string;
  name: string;
  credits: number;
  facultyCode: string;
  applicableTerms: TermCode[];
  applicableDegrees: string[];
  defaultSyllabusVersion: SyllabusVersion;
  outlineTemplate: ModuleOutlineTemplateItem[];
  updatedAt: string;
}

interface FacultyOption {
  code: string;
  name: string;
}

interface DegreeOption {
  code: string;
  name: string;
  facultyCode: string;
}

interface ModuleFormState {
  code: string;
  name: string;
  credits: string;
  facultyCode: string;
  applicableTerms: TermCode[];
  applicableDegrees: string[];
  defaultSyllabusVersion: SyllabusVersion;
  outlineTemplate: ModuleOutlineTemplateItem[];
}

const TERM_SEQUENCE: TermCode[] = [
  "Y1S1",
  "Y1S2",
  "Y2S1",
  "Y2S2",
  "Y3S1",
  "Y3S2",
  "Y4S1",
  "Y4S2",
];

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

function normalizeFacultyCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
}

function normalizeSyllabusVersion(value: unknown): SyllabusVersion {
  return value === "OLD" ? "OLD" : "NEW";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toISOString().slice(0, 10);
}

function emptyFormState(): ModuleFormState {
  return {
    code: "",
    name: "",
    credits: "4",
    facultyCode: "",
    applicableTerms: ["Y1S1"],
    applicableDegrees: [],
    defaultSyllabusVersion: "NEW",
    outlineTemplate: [
      { weekNo: 1, title: "Week 1", type: "LECTURE" },
      { weekNo: 7, title: "Mid Exam", type: "MID" },
    ],
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | T
    | { message?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "message" in payload && payload.message
        ? payload.message
        : "Request failed"
    );
  }

  return (payload ?? ({} as T)) as T;
}

export default function AdminModulesPage() {
  const { toast } = useToast();

  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [faculties, setFaculties] = useState<FacultyOption[]>([]);
  const [degrees, setDegrees] = useState<DegreeOption[]>([]);
  const [form, setForm] = useState<ModuleFormState>(emptyFormState());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");

  const filteredDegrees = useMemo(
    () => degrees.filter((degree) => degree.facultyCode === form.facultyCode),
    [degrees, form.facultyCode]
  );

  const visibleModules = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return modules;
    return modules.filter((module) =>
      `${module.code} ${module.name}`.toLowerCase().includes(query)
    );
  }, [modules, search]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [moduleResponse, facultyResponse, degreeResponse] = await Promise.all([
        fetch("/api/modules?page=1&pageSize=100&sort=az", { cache: "no-store" }),
        fetch("/api/faculties", { cache: "no-store" }),
        fetch("/api/degree-programs?page=1&pageSize=100&sort=az", { cache: "no-store" }),
      ]);

      const [modulePayload, facultyPayload, degreePayload] = await Promise.all([
        readJson<unknown>(moduleResponse),
        readJson<unknown>(facultyResponse),
        readJson<unknown>(degreeResponse),
      ]);

      const moduleItems = Array.isArray(asObject(modulePayload)?.items)
        ? (asObject(modulePayload)?.items as unknown[])
        : [];
      const degreeItems = Array.isArray(asObject(degreePayload)?.items)
        ? (asObject(degreePayload)?.items as unknown[])
        : [];

      setModules(
        moduleItems
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => ({
            id: String(item.id ?? ""),
            code: String(item.code ?? "").toUpperCase(),
            name: String(item.name ?? ""),
            credits: Number(item.credits) || 0,
            facultyCode: normalizeFacultyCode(String(item.facultyCode ?? "")),
            applicableTerms: Array.isArray(item.applicableTerms)
              ? item.applicableTerms
                  .map((term) => String(term ?? "").toUpperCase())
                  .filter((term): term is TermCode => TERM_SEQUENCE.includes(term as TermCode))
              : [],
            applicableDegrees: Array.isArray(item.applicableDegrees)
              ? item.applicableDegrees.map((degree) =>
                  normalizeFacultyCode(String(degree ?? ""))
                )
              : [],
            defaultSyllabusVersion: normalizeSyllabusVersion(item.defaultSyllabusVersion),
            outlineTemplate: Array.isArray(item.outlineTemplate)
              ? item.outlineTemplate
                  .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
                  .map((row) => ({
                    weekNo: Number(row.weekNo) || 1,
                    title: String(row.title ?? ""),
                    type:
                      String(row.type ?? "") === "MID" ||
                      String(row.type ?? "") === "QUIZ" ||
                      String(row.type ?? "") === "LAB" ||
                      String(row.type ?? "") === "OTHER"
                        ? (String(row.type ?? "") as ModuleOutlineTemplateItem["type"])
                        : "LECTURE",
                  }))
              : [],
            updatedAt: String(item.updatedAt ?? ""),
          }))
          .filter((item) => Boolean(item.id && item.code))
      );

      setFaculties(
        Array.isArray(facultyPayload)
          ? facultyPayload
              .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
              .map((item) => ({
                code: normalizeFacultyCode(String(item.code ?? "")),
                name: String(item.name ?? ""),
              }))
              .filter((item) => Boolean(item.code))
          : []
      );

      setDegrees(
        degreeItems
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => ({
            code: normalizeFacultyCode(String(item.code ?? "")),
            name: String(item.name ?? ""),
            facultyCode: normalizeFacultyCode(String(item.facultyCode ?? "")),
          }))
          .filter((item) => Boolean(item.code && item.facultyCode))
      );
    } catch (error) {
      toast({
        title: "Failed",
        message: error instanceof Error ? error.message : "Failed to load modules",
        variant: "error",
      });
      setModules([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyFormState());
  };

  const save = async () => {
    const code = normalizeCode(form.code);
    const name = form.name.trim();
    const credits = Number(form.credits);
    const payload = {
      code,
      name,
      credits,
      facultyCode: form.facultyCode,
      applicableTerms: form.applicableTerms,
      applicableDegrees: form.applicableDegrees,
      defaultSyllabusVersion: form.defaultSyllabusVersion,
      outlineTemplate: form.outlineTemplate
        .map((item) => ({
          weekNo: Math.max(1, Math.min(60, Math.floor(Number(item.weekNo) || 1))),
          title: String(item.title ?? "").trim(),
          type: item.type ?? "LECTURE",
        }))
        .filter((item) => Boolean(item.title)),
    };

    if (!code || !name || !Number.isFinite(credits) || credits <= 0) {
      toast({
        title: "Failed",
        message: "Code, name and credits are required",
        variant: "error",
      });
      return;
    }

    if (!payload.facultyCode || payload.applicableTerms.length === 0 || payload.applicableDegrees.length === 0) {
      toast({
        title: "Failed",
        message: "Faculty, applicable terms and degrees are required",
        variant: "error",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        editingId ? `/api/modules/${encodeURIComponent(editingId)}` : "/api/modules",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      await readJson(response);
      toast({
        title: "Saved",
        message: `Module ${editingId ? "updated" : "created"} successfully`,
        variant: "success",
      });
      resetForm();
      await loadData();
    } catch (error) {
      toast({
        title: "Failed",
        message: error instanceof Error ? error.message : "Failed to save module",
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        actions={
          <Button
            className="h-11 gap-2 bg-[#034aa6] px-5 text-white hover:bg-[#0339a6]"
            onClick={() => void loadData()}
            variant="primary"
          >
            <RefreshCcw size={15} />
            Refresh
          </Button>
        }
        description="Master modules with faculty, term and degree applicability."
        title="Modules"
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
        <Card title={editingId ? "Edit Module" : "Add Module"}>
          <div className="space-y-3">
            <Input disabled={Boolean(editingId) || isSaving} onChange={(event) => setForm((previous) => ({ ...previous, code: event.target.value }))} placeholder="Code (SE101)" value={form.code} />
            <Input disabled={isSaving} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Module Name" value={form.name} />
            <Input disabled={isSaving} min={1} onChange={(event) => setForm((previous) => ({ ...previous, credits: event.target.value }))} placeholder="Credits" type="number" value={form.credits} />
            <Select disabled={isSaving} onChange={(event) => setForm((previous) => ({ ...previous, facultyCode: event.target.value, applicableDegrees: [] }))} value={form.facultyCode}>
              <option value="">Select Faculty</option>
              {faculties.map((faculty) => (
                <option key={faculty.code} value={faculty.code}>
                  {faculty.code} - {faculty.name}
                </option>
              ))}
            </Select>
            <Select disabled={isSaving} onChange={(event) => setForm((previous) => ({ ...previous, defaultSyllabusVersion: event.target.value === "OLD" ? "OLD" : "NEW" }))} value={form.defaultSyllabusVersion}>
              <option value="NEW">Default Syllabus: NEW</option>
              <option value="OLD">Default Syllabus: OLD</option>
            </Select>

            <div className="rounded-2xl border border-border bg-tint/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">Applicable Terms</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {TERM_SEQUENCE.map((term) => (
                  <label className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-2.5 py-1.5 text-sm text-heading" key={term}>
                    <input checked={form.applicableTerms.includes(term)} className="h-4 w-4 rounded border-border" disabled={isSaving} onChange={() => setForm((previous) => ({ ...previous, applicableTerms: previous.applicableTerms.includes(term) ? previous.applicableTerms.filter((item) => item !== term) : [...previous.applicableTerms, term] }))} type="checkbox" />
                    {term}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-tint/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">Applicable Degrees</p>
              <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
                {filteredDegrees.length === 0 ? (
                  <p className="text-sm text-text/65">Select faculty to load degrees</p>
                ) : (
                  filteredDegrees.map((degree) => (
                    <label className="inline-flex w-full items-center gap-2 rounded-xl border border-border bg-white px-2.5 py-1.5 text-sm text-heading" key={degree.code}>
                      <input checked={form.applicableDegrees.includes(degree.code)} className="h-4 w-4 rounded border-border" disabled={isSaving} onChange={() => setForm((previous) => ({ ...previous, applicableDegrees: previous.applicableDegrees.includes(degree.code) ? previous.applicableDegrees.filter((item) => item !== degree.code) : [...previous.applicableDegrees, degree.code] }))} type="checkbox" />
                      {degree.code} - {degree.name}
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            {editingId ? (
              <Button className="h-10 border-slate-300 bg-white px-4 text-heading hover:bg-slate-50" disabled={isSaving} onClick={resetForm} variant="secondary">
                <X size={14} />
                Cancel Edit
              </Button>
            ) : null}
            <Button className="h-10 gap-2 bg-[#034aa6] px-4 text-white hover:bg-[#0339a6]" disabled={isSaving} onClick={() => void save()}>
              {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
              {editingId ? "Update Module" : "Create Module"}
            </Button>
          </div>
        </Card>

        <Card title="Module List">
          <Input className="h-10" onChange={(event) => setSearch(event.target.value)} placeholder="Search module" value={search} />
          <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-tint">
                <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Applicability</th>
                  <th className="px-4 py-3">Syllabus</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="px-4 py-6 text-text/65" colSpan={5}>
                      Loading modules...
                    </td>
                  </tr>
                ) : null}
                {!isLoading && visibleModules.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-text/65" colSpan={5}>
                      No modules found.
                    </td>
                  </tr>
                ) : null}
                {!isLoading
                  ? visibleModules.map((module) => (
                      <tr className="border-b border-border/70" key={module.id}>
                        <td className="px-4 py-3 font-semibold text-heading">
                          {module.code} - {module.name}
                        </td>
                        <td className="px-4 py-3 text-text/78">
                          {module.facultyCode} | {module.applicableDegrees.join(", ")} |{" "}
                          {module.applicableTerms.join(", ")}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={module.defaultSyllabusVersion === "OLD" ? "warning" : "primary"}>
                            {module.defaultSyllabusVersion}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-text/78">{formatDate(module.updatedAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <button
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-text/70 hover:bg-tint hover:text-heading"
                              onClick={() => {
                                setEditingId(module.id);
                                setForm({
                                  code: module.code,
                                  name: module.name,
                                  credits: String(module.credits),
                                  facultyCode: module.facultyCode,
                                  applicableTerms: module.applicableTerms,
                                  applicableDegrees: module.applicableDegrees,
                                  defaultSyllabusVersion: module.defaultSyllabusVersion,
                                  outlineTemplate: module.outlineTemplate,
                                });
                              }}
                              type="button"
                            >
                              <Pencil size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

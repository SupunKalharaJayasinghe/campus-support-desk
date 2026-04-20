"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import {
  ArrowUpDown,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useAdminContext } from "@/components/admin/AdminContext";
import TablePagination from "@/components/admin/TablePagination";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/ToastProvider";
import ConfirmDeleteOfferingModal from "./components/ConfirmDeleteOfferingModal";
import EditOfferingModal, {
  type EditOfferingContext,
  type ModuleAssignmentSnapshot,
  type OfferingDegreeOption,
  type OfferingFacultyOption,
  type OfferingFormState,
  type OfferingIntakeOption,
  type OfferingModuleOption,
  type OfferingStaffItem,
  type OfferingStatus,
} from "./components/EditOfferingModal";

type PageSize = 10 | 25 | 50 | 100;
type SortOption = "updated" | "module" | "term";
type TermCode = "Y1S1" | "Y1S2" | "Y2S1" | "Y2S2" | "Y3S1" | "Y3S2" | "Y4S1" | "Y4S2";
type ModalMode = "add" | "edit";
type SummaryTone = "sky" | "teal" | "amber" | "green" | "rose" | "violet";

interface DegreeOption extends OfferingDegreeOption { facultyCode: string }
interface IntakeOption extends OfferingIntakeOption { facultyCode: string; degreeCode: string }
interface OfferingRecord extends EditOfferingContext { createdAt: string; updatedAt: string }

const TERM_OPTIONS: TermCode[] = ["Y1S1", "Y1S2", "Y2S1", "Y2S2", "Y3S1", "Y3S2", "Y4S1", "Y4S2"];
const SORT_LABELS: Record<SortOption, string> = {
  updated: "Recently Updated",
  module: "Module Code",
  term: "Term",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const code = (v: unknown) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
const sid = (v: unknown) => String(v ?? "").trim();
const txt = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const status = (v: unknown): OfferingStatus => (v === "INACTIVE" ? "INACTIVE" : "ACTIVE");
const syllabus = (v: unknown) => (v === "OLD" ? "OLD" : "NEW");
const asObj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

const fmtDate = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toISOString().slice(0, 10);
};

const fmtShortDate = (v?: string | null) => {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
};

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) {
    const msg = payload && typeof payload === "object" && "message" in payload ? payload.message : "Request failed";
    throw new Error(msg || "Request failed");
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

const parseStaff = (value: unknown): OfferingStaffItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = asObj(item);
      if (!row) return null;
      const id = sid(row.id ?? row._id);
      if (!id) return null;
      return { id, fullName: txt(row.fullName) || id, email: String(row.email ?? "").trim().toLowerCase(), status: String(row.status ?? "").trim().toUpperCase() || "ACTIVE" } satisfies OfferingStaffItem;
    })
    .filter((item): item is OfferingStaffItem => Boolean(item));
};

const parseOfferings = (payload: unknown) => {
  const root = asObj(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];
  const items = rows
    .map((item) => {
      const row = asObj(item);
      if (!row) return null;
      const moduleObj = asObj(row.module);
      const facultyObj = asObj(row.faculty);
      const degreeObj = asObj(row.degree);
      const intakeObj = asObj(row.intake);
      const id = sid(row.id ?? row._id);
      const moduleId = sid(row.moduleCode ?? row.moduleId ?? moduleObj?.code ?? moduleObj?._id);
      const intakeId = sid(row.intakeName ?? row.intakeId ?? intakeObj?.name ?? intakeObj?._id);
      if (!id || !moduleId || !intakeId) return null;
      return {
        id,
        facultyId: code(row.facultyCode ?? row.facultyId ?? facultyObj?.code),
        facultyName: txt(facultyObj?.name),
        degreeProgramId: code(row.degreeCode ?? row.degreeProgramId ?? degreeObj?.code),
        degreeProgramName: txt(degreeObj?.name),
        intakeId,
        intakeName: txt(row.intakeName ?? intakeObj?.name),
        termCode: String(row.termCode ?? "").trim().toUpperCase(),
        moduleId,
        moduleCode: String(row.moduleCode ?? moduleObj?.code ?? moduleId ?? "").trim().toUpperCase(),
        moduleName: txt(row.moduleName ?? moduleObj?.name),
        syllabusVersion: syllabus(row.syllabusVersion),
        status: status(row.status),
        lecturers: parseStaff(row.lecturers),
        labAssistants: parseStaff(row.labAssistants),
        createdAt: String(row.createdAt ?? ""),
        updatedAt: String(row.updatedAt ?? ""),
      } satisfies OfferingRecord;
    })
    .filter((item): item is OfferingRecord => Boolean(item));
  const total = Math.max(0, Number(root?.total) || items.length);
  const page = Math.max(1, Number(root?.page) || 1);
  const pageSize = [10, 25, 50, 100].includes(Number(root?.pageSize)) ? (Number(root?.pageSize) as PageSize) : 10;
  return { items, total, page, pageSize };
};

const parseFaculties = (payload: unknown): OfferingFacultyOption[] =>
  (Array.isArray(payload) ? payload : [])
    .map((item) => {
      const row = asObj(item);
      if (!row) return null;
      const c = code(row.code);
      return c ? ({ code: c, name: txt(row.name) } satisfies OfferingFacultyOption) : null;
    })
    .filter((item): item is OfferingFacultyOption => Boolean(item));

const parseDegrees = (payload: unknown): DegreeOption[] => {
  const root = asObj(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];
  return rows
    .map((item) => {
      const row = asObj(item);
      if (!row) return null;
      const c = code(row.code ?? row.id);
      const f = code(row.facultyCode ?? row.facultyId);
      return c && f ? ({ code: c, name: txt(row.name), facultyCode: f } satisfies DegreeOption) : null;
    })
    .filter((item): item is DegreeOption => Boolean(item));
};

const parseIntakes = (payload: unknown): IntakeOption[] => {
  const root = asObj(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];
  const mapped = rows.map((item): IntakeOption | null => {
      const row = asObj(item);
      if (!row) return null;
      const id = sid(row.name ?? row.id ?? row._id);
      if (!id) return null;
      const currentTerm = String(row.currentTerm ?? "").trim().toUpperCase();
      return { id, name: txt(row.name), currentTerm: currentTerm || undefined, facultyCode: code(row.facultyCode ?? row.facultyId), degreeCode: code(row.degreeCode ?? row.degreeId) };
    });

  return mapped.filter((item): item is IntakeOption => item !== null);
};

const parseModules = (payload: unknown): OfferingModuleOption[] => {
  const root = asObj(payload);
  const rows = Array.isArray(root?.items) ? (root.items as unknown[]) : [];
  return rows
    .map((item) => {
      const row = asObj(item);
      if (!row) return null;
      const id = String(row.code ?? row.id ?? row._id ?? "").trim().toUpperCase();
      if (!id) return null;
      return { id, code: String(row.code ?? "").trim().toUpperCase(), name: txt(row.name), defaultSyllabusVersion: syllabus(row.defaultSyllabusVersion) } satisfies OfferingModuleOption;
    })
    .filter((item): item is OfferingModuleOption => Boolean(item));
};

const parseEligible = (payload: unknown) => {
  const root = asObj(payload);
  return parseStaff(Array.isArray(root?.items) ? root.items : []);
};

const emptyForm = (): OfferingFormState => ({ facultyId: "", degreeProgramId: "", intakeId: "", termCode: "Y1S1", moduleId: "", syllabusVersion: "NEW", status: "ACTIVE", assignedLecturerIds: [], assignedLabAssistantIds: [] });

function staffChipLabel(staff: OfferingStaffItem[], id: string) {
  return staff.find((item) => item.id === id)?.fullName ?? id;
}

export default function ModuleOfferingsPage() {
  const { setActiveWindow } = useAdminContext();
  const { toast } = useToast();

  const [items, setItems] = useState<OfferingRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingModules, setIsLoadingModules] = useState(false);
  const [isLoadingModuleAssignments, setIsLoadingModuleAssignments] = useState(false);
  const [isLoadingLecturers, setIsLoadingLecturers] = useState(false);
  const [isLoadingLabAssistants, setIsLoadingLabAssistants] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [facultyFilter, setFacultyFilter] = useState("");
  const [degreeFilter, setDegreeFilter] = useState("");
  const [intakeFilter, setIntakeFilter] = useState("");
  const [termFilter, setTermFilter] = useState<"" | TermCode>("");
  const [statusFilter, setStatusFilter] = useState<"" | OfferingStatus>("");
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);

  const [faculties, setFaculties] = useState<OfferingFacultyOption[]>([]);
  const [filterDegrees, setFilterDegrees] = useState<DegreeOption[]>([]);
  const [filterIntakes, setFilterIntakes] = useState<IntakeOption[]>([]);

  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editTarget, setEditTarget] = useState<OfferingRecord | null>(null);
  const [form, setForm] = useState<OfferingFormState>(emptyForm());
  const [modalDegrees, setModalDegrees] = useState<DegreeOption[]>([]);
  const [modalIntakes, setModalIntakes] = useState<IntakeOption[]>([]);
  const [modalModules, setModalModules] = useState<OfferingModuleOption[]>([]);
  const [moduleAssignments, setModuleAssignments] = useState<ModuleAssignmentSnapshot[]>([]);
  const [eligibleLecturers, setEligibleLecturers] = useState<OfferingStaffItem[]>([]);
  const [eligibleLabAssistants, setEligibleLabAssistants] = useState<OfferingStaffItem[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<OfferingRecord | null>(null);
  const [quickAssignTarget, setQuickAssignTarget] = useState<OfferingRecord | null>(null);
  const [quickAssignEligibleLecturers, setQuickAssignEligibleLecturers] = useState<OfferingStaffItem[]>([]);
  const [quickAssignSelectedLecturerIds, setQuickAssignSelectedLecturerIds] = useState<string[]>([]);
  const [quickAssignSearch, setQuickAssignSearch] = useState("");
  const [isLoadingQuickAssignLecturers, setIsLoadingQuickAssignLecturers] = useState(false);
  const [isSavingQuickAssign, setIsSavingQuickAssign] = useState(false);

  const deferredSearch = useDeferredValue(searchQuery);
  const isModalOpen = Boolean(modalMode);
  const isOverlayOpen = Boolean(isModalOpen || deleteTarget || quickAssignTarget);

  const loadDegrees = useCallback(async (facultyId: string) => {
    if (!code(facultyId)) return [] as DegreeOption[];
    const payload = await readJson<unknown>(await fetch(`/api/degrees?facultyId=${encodeURIComponent(code(facultyId))}&status=ACTIVE`, { cache: "no-store" }));
    return parseDegrees(payload);
  }, []);

  const loadIntakes = useCallback(async (facultyId: string, degreeId: string) => {
    if (!code(degreeId)) return [] as IntakeOption[];
    const params = new URLSearchParams({ page: "1", pageSize: "100", sort: "az", degreeProgramId: code(degreeId), status: "ACTIVE" });
    if (code(facultyId)) params.set("facultyId", code(facultyId));
    const payload = await readJson<unknown>(await fetch(`/api/intakes?${params.toString()}`, { cache: "no-store" }));
    return parseIntakes(payload);
  }, []);

  const loadModules = useCallback(async (facultyId: string, degreeProgramId: string, termCode: string) => {
    if (!code(facultyId) || !code(degreeProgramId) || !String(termCode ?? "").trim()) return [] as OfferingModuleOption[];
    const params = new URLSearchParams({ facultyCode: code(facultyId), degreeId: code(degreeProgramId), term: String(termCode).trim().toUpperCase() });
    const payload = await readJson<unknown>(await fetch(`/api/modules/applicable?${params.toString()}`, { cache: "no-store" }));
    return parseModules(payload);
  }, []);

  const loadEligible = useCallback(async (kind: "lecturers" | "lab-assistants", facultyId: string, degreeProgramId: string, moduleId: string) => {
    if (!code(facultyId) || !code(degreeProgramId) || !sid(moduleId)) {
      if (kind === "lecturers") {
        setEligibleLecturers([]);
        setForm((p) => ({ ...p, assignedLecturerIds: [] }));
      } else {
        setEligibleLabAssistants([]);
        setForm((p) => ({ ...p, assignedLabAssistantIds: [] }));
      }
      return;
    }

    if (kind === "lecturers") {
      setIsLoadingLecturers(true);
    } else {
      setIsLoadingLabAssistants(true);
    }

    try {
      const params = new URLSearchParams({ facultyCode: code(facultyId), degreeCode: code(degreeProgramId), moduleCode: sid(moduleId) });
      const payload = await readJson<unknown>(await fetch(`/api/module-offerings/eligible-${kind}?${params.toString()}`, { cache: "no-store" }));
      const rows = parseEligible(payload);
      const allowed = new Set(rows.map((r) => r.id));
      if (kind === "lecturers") {
        setEligibleLecturers(rows);
        setForm((p) => ({ ...p, assignedLecturerIds: p.assignedLecturerIds.filter((id) => allowed.has(id)) }));
      } else {
        setEligibleLabAssistants(rows);
        setForm((p) => ({ ...p, assignedLabAssistantIds: p.assignedLabAssistantIds.filter((id) => allowed.has(id)) }));
      }
    } catch {
      if (kind === "lecturers") {
        setEligibleLecturers([]);
        setForm((p) => ({ ...p, assignedLecturerIds: [] }));
      } else {
        setEligibleLabAssistants([]);
        setForm((p) => ({ ...p, assignedLabAssistantIds: [] }));
      }
    } finally {
      if (kind === "lecturers") {
        setIsLoadingLecturers(false);
      } else {
        setIsLoadingLabAssistants(false);
      }
    }
  }, []);

  const loadModuleAssignments = useCallback(async (moduleCodeOrId: string) => {
    const moduleCode = sid(moduleCodeOrId).toUpperCase();
    if (!moduleCode) {
      setModuleAssignments([]);
      return;
    }

    setIsLoadingModuleAssignments(true);
    try {
      const collected: OfferingRecord[] = [];
      const maxPageSize: PageSize = 100;
      let currentPage = 1;
      let expectedTotal = Number.POSITIVE_INFINITY;

      while (collected.length < expectedTotal) {
        const params = new URLSearchParams({
          moduleCode,
          page: String(currentPage),
          pageSize: String(maxPageSize),
          sort: "term",
        });
        const parsed = parseOfferings(
          await readJson<unknown>(
            await fetch(`/api/module-offerings?${params.toString()}`, {
              cache: "no-store",
            })
          )
        );

        expectedTotal = Math.max(0, parsed.total);
        if (parsed.items.length === 0) {
          break;
        }

        collected.push(...parsed.items);

        if (collected.length >= expectedTotal) {
          break;
        }

        currentPage += 1;
      }

      const byId = new Map<string, OfferingRecord>();
      collected.forEach((item) => {
        byId.set(item.id, item);
      });

      setModuleAssignments(
        Array.from(byId.values()).map((item) => ({
          id: item.id,
          moduleCode: item.moduleCode,
          moduleName: item.moduleName,
          facultyId: item.facultyId,
          degreeProgramId: item.degreeProgramId,
          intakeName: item.intakeName || item.intakeId,
          termCode: item.termCode,
          lecturers: item.lecturers,
          labAssistants: item.labAssistants,
          status: item.status,
        }))
      );
    } catch {
      setModuleAssignments([]);
    } finally {
      setIsLoadingModuleAssignments(false);
    }
  }, []);

  const loadOfferings = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort: sortBy });
      if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
      if (facultyFilter) params.set("facultyCode", facultyFilter);
      if (degreeFilter) params.set("degreeCode", degreeFilter);
      if (intakeFilter) params.set("intakeName", intakeFilter);
      if (termFilter) params.set("termCode", termFilter);
      if (statusFilter) params.set("status", statusFilter);
      const parsed = parseOfferings(await readJson<unknown>(await fetch(`/api/module-offerings?${params.toString()}`, { cache: "no-store" })));
      setItems(parsed.items);
      setTotalCount(parsed.total);
    } catch (error) {
      toast({ title: "Failed", message: error instanceof Error ? error.message : "Failed to load module offerings", variant: "error" });
      setItems([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [deferredSearch, degreeFilter, facultyFilter, intakeFilter, page, pageSize, sortBy, statusFilter, termFilter, toast]);

  useEffect(() => { void loadOfferings(); }, [loadOfferings]);
  useEffect(() => { void (async () => {
    try { setFaculties(parseFaculties(await readJson<unknown>(await fetch("/api/faculties", { cache: "no-store" })))); }
    catch { setFaculties([]); }
  })(); }, []);

  useEffect(() => {
    if (!facultyFilter) { setFilterDegrees([]); setDegreeFilter(""); setFilterIntakes([]); setIntakeFilter(""); return; }
    setDegreeFilter(""); setFilterIntakes([]); setIntakeFilter("");
    void loadDegrees(facultyFilter).then(setFilterDegrees).catch(() => setFilterDegrees([]));
  }, [facultyFilter, loadDegrees]);

  useEffect(() => {
    if (!degreeFilter) { setFilterIntakes([]); setIntakeFilter(""); return; }
    setIntakeFilter("");
    void loadIntakes(facultyFilter, degreeFilter).then(setFilterIntakes).catch(() => setFilterIntakes([]));
  }, [degreeFilter, facultyFilter, loadIntakes]);

  useEffect(() => {
    if (!isOverlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOverlayOpen]);

  useEffect(() => {
    if (modalMode === "add") { setActiveWindow("Create Offering"); return; }
    if (modalMode === "edit") { setActiveWindow("Edit Offering"); return; }
    if (quickAssignTarget) { setActiveWindow("Assign Lecturers"); return; }
    setActiveWindow(null);
  }, [modalMode, quickAssignTarget, setActiveWindow]);

  useEffect(() => () => setActiveWindow(null), [setActiveWindow]);

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, pageCount);
  const contentBlurClass = isOverlayOpen ? "pointer-events-none opacity-45 blur-[1px]" : "";
  const activeFilterCount = [
    facultyFilter,
    degreeFilter,
    intakeFilter,
    termFilter,
    statusFilter,
  ].filter(Boolean).length;
  const filtersApplied = Boolean(searchQuery.trim() || activeFilterCount > 0);
  const activeOfferingsCount = useMemo(
    () => items.filter((item) => item.status === "ACTIVE").length,
    [items]
  );
  const lecturerAssignmentsCount = useMemo(
    () => items.reduce((total, item) => total + item.lecturers.length, 0),
    [items]
  );
  const latestUpdatedAt = useMemo(
    () =>
      items.reduce<string | null>((latest, item) => {
        if (!item.updatedAt) return latest;
        if (!latest || item.updatedAt.localeCompare(latest) > 0) {
          return item.updatedAt;
        }
        return latest;
      }, null),
    [items]
  );
  const summaryCards: Array<{
    label: string;
    value: string;
    detail: string;
    tone: SummaryTone;
    icon: ComponentType<{ size?: number }>;
  }> = [
    {
      label: "Total Offerings",
      value: totalCount.toLocaleString(),
      detail: `${items.length.toLocaleString()} rows loaded on this page`,
      tone: "sky",
      icon: BookOpen,
    },
    {
      label: "Active Offerings",
      value: activeOfferingsCount.toLocaleString(),
      detail:
        activeOfferingsCount > 0
          ? `${activeOfferingsCount.toLocaleString()} active offerings in view`
          : "No active offerings in the current view",
      tone: "green",
      icon: CheckCircle2,
    },
    {
      label: "Lecturer Links",
      value: lecturerAssignmentsCount.toLocaleString(),
      detail:
        lecturerAssignmentsCount > 0
          ? `${lecturerAssignmentsCount.toLocaleString()} lecturer assignments visible`
          : "No lecturer assignments in the current view",
      tone: "violet",
      icon: Users,
    },
    {
      label: "Latest Update",
      value: fmtShortDate(latestUpdatedAt),
      detail:
        latestUpdatedAt !== null
          ? "Most recent visible offering change"
          : "No offering updates loaded yet",
      tone: "amber",
      icon: Clock3,
    },
  ];

  const resetFilters = () => {
    setSearchQuery("");
    setFacultyFilter("");
    setDegreeFilter("");
    setIntakeFilter("");
    setTermFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const closeModal = () => {
    if (isSaving) return;
    setModalMode(null); setEditTarget(null); setForm(emptyForm()); setModalDegrees([]); setModalIntakes([]); setModalModules([]); setModuleAssignments([]); setEligibleLecturers([]); setEligibleLabAssistants([]); setIsLoadingModuleAssignments(false);
  };

  const openAddModal = () => { setModalMode("add"); setEditTarget(null); setForm(emptyForm()); setModalDegrees([]); setModalIntakes([]); setModalModules([]); setModuleAssignments([]); setEligibleLecturers([]); setEligibleLabAssistants([]); setIsLoadingModuleAssignments(false); };

  const openEditModal = (offering: OfferingRecord) => {
    setModalMode("edit");
    setEditTarget(offering);
    setForm({ facultyId: offering.facultyId, degreeProgramId: offering.degreeProgramId, intakeId: offering.intakeId, termCode: offering.termCode, moduleId: offering.moduleId, syllabusVersion: offering.syllabusVersion, status: offering.status, assignedLecturerIds: offering.lecturers.map((r) => r.id), assignedLabAssistantIds: offering.labAssistants.map((r) => r.id) });
    setModalDegrees([]); setModalIntakes([]); setModalModules([]); setModuleAssignments([]); setEligibleLecturers([]); setEligibleLabAssistants([]);
    void loadDegrees(offering.facultyId).then(setModalDegrees).catch(() => setModalDegrees([]));
    void loadIntakes(offering.facultyId, offering.degreeProgramId).then(setModalIntakes).catch(() => setModalIntakes([]));
    setIsLoadingModules(true);
    void loadModules(offering.facultyId, offering.degreeProgramId, offering.termCode).then(setModalModules).catch(() => setModalModules([])).finally(() => setIsLoadingModules(false));
    void loadModuleAssignments(offering.moduleId);
    void loadEligible("lecturers", offering.facultyId, offering.degreeProgramId, offering.moduleId);
    void loadEligible("lab-assistants", offering.facultyId, offering.degreeProgramId, offering.moduleId);
  };

  const closeQuickAssignModal = () => {
    setQuickAssignTarget(null);
    setQuickAssignEligibleLecturers([]);
    setQuickAssignSelectedLecturerIds([]);
    setQuickAssignSearch("");
    setIsLoadingQuickAssignLecturers(false);
  };

  const openQuickAssignModal = (offering: OfferingRecord) => {
    setQuickAssignTarget(offering);
    setQuickAssignSelectedLecturerIds(offering.lecturers.map((lecturer) => lecturer.id));
    setQuickAssignSearch("");
    setQuickAssignEligibleLecturers(offering.lecturers);
    setIsLoadingQuickAssignLecturers(true);

    void (async () => {
      try {
        const payload = await readJson<unknown>(
          await fetch(
            `/api/module-offerings/${encodeURIComponent(offering.id)}/eligible-lecturers`,
            { cache: "no-store" }
          )
        );
        const eligible = parseEligible(payload);
        const merged = new Map<string, OfferingStaffItem>();
        [...offering.lecturers, ...eligible].forEach((lecturer) => {
          merged.set(lecturer.id, lecturer);
        });
        setQuickAssignEligibleLecturers(Array.from(merged.values()));
      } catch (error) {
        toast({
          title: "Failed",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load eligible lecturers",
          variant: "error",
        });
        setQuickAssignEligibleLecturers(offering.lecturers);
      } finally {
        setIsLoadingQuickAssignLecturers(false);
      }
    })();
  };

  const toggleQuickAssignLecturer = (lecturerId: string) => {
    setQuickAssignSelectedLecturerIds((current) =>
      current.includes(lecturerId)
        ? current.filter((id) => id !== lecturerId)
        : [...current, lecturerId]
    );
  };

  const saveQuickAssign = async () => {
    if (!quickAssignTarget) return;
    setIsSavingQuickAssign(true);
    try {
      await readJson<unknown>(
        await fetch(
          `/api/module-offerings/${encodeURIComponent(quickAssignTarget.id)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assignedLecturerIds: quickAssignSelectedLecturerIds,
            }),
          }
        )
      );
      toast({
        title: "Saved",
        message: "Lecturer assignments updated",
        variant: "success",
      });
      closeQuickAssignModal();
      await loadOfferings();
    } catch (error) {
      toast({
        title: "Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update lecturer assignments",
        variant: "error",
      });
    } finally {
      setIsSavingQuickAssign(false);
    }
  };

  const handleFacultyChange = (value: string) => {
    const facultyId = code(value);
    setForm((p) => ({ ...p, facultyId, degreeProgramId: "", intakeId: "", moduleId: "", assignedLecturerIds: [], assignedLabAssistantIds: [] }));
    setModalDegrees([]); setModalIntakes([]); setModalModules([]); setModuleAssignments([]); setEligibleLecturers([]); setEligibleLabAssistants([]);
    if (facultyId) void loadDegrees(facultyId).then(setModalDegrees).catch(() => setModalDegrees([]));
  };

  const handleDegreeChange = (value: string) => {
    const degreeProgramId = code(value);
    setForm((p) => ({ ...p, degreeProgramId, intakeId: "", moduleId: "", assignedLecturerIds: [], assignedLabAssistantIds: [] }));
    setModalIntakes([]); setModalModules([]); setModuleAssignments([]); setEligibleLecturers([]); setEligibleLabAssistants([]);
    if (!form.facultyId || !degreeProgramId) return;
    void loadIntakes(form.facultyId, degreeProgramId).then(setModalIntakes).catch(() => setModalIntakes([]));
    setIsLoadingModules(true);
    void loadModules(form.facultyId, degreeProgramId, form.termCode).then(setModalModules).catch(() => setModalModules([])).finally(() => setIsLoadingModules(false));
  };

  const handleTermChange = (value: string) => {
    const termCode = String(value ?? "").trim().toUpperCase();
    setForm((p) => ({ ...p, termCode, moduleId: "", assignedLecturerIds: [], assignedLabAssistantIds: [] }));
    setModalModules([]); setModuleAssignments([]); setEligibleLecturers([]); setEligibleLabAssistants([]);
    if (!form.facultyId || !form.degreeProgramId || !termCode) return;
    setIsLoadingModules(true);
    void loadModules(form.facultyId, form.degreeProgramId, termCode).then(setModalModules).catch(() => setModalModules([])).finally(() => setIsLoadingModules(false));
  };

  const handleModuleChange = (value: string) => {
    const moduleId = sid(value);
    const selected = modalModules.find((m) => m.id === moduleId) ?? null;
    setForm((p) => ({ ...p, moduleId, assignedLecturerIds: [], assignedLabAssistantIds: [], syllabusVersion: modalMode === "add" && selected ? selected.defaultSyllabusVersion : p.syllabusVersion }));
    if (!form.facultyId || !form.degreeProgramId || !moduleId) { setModuleAssignments([]); setEligibleLecturers([]); setEligibleLabAssistants([]); return; }
    void loadModuleAssignments(moduleId);
    void loadEligible("lecturers", form.facultyId, form.degreeProgramId, moduleId);
    void loadEligible("lab-assistants", form.facultyId, form.degreeProgramId, moduleId);
  };

  const toggleLecturer = (id: string) => setForm((p) => ({ ...p, assignedLecturerIds: p.assignedLecturerIds.includes(id) ? p.assignedLecturerIds.filter((x) => x !== id) : [...p.assignedLecturerIds, id] }));
  const toggleLab = (id: string) => setForm((p) => ({ ...p, assignedLabAssistantIds: p.assignedLabAssistantIds.includes(id) ? p.assignedLabAssistantIds.filter((x) => x !== id) : [...p.assignedLabAssistantIds, id] }));
  const addAllEligibleLecturers = () =>
    setForm((p) => ({
      ...p,
      assignedLecturerIds: Array.from(
        new Set([...p.assignedLecturerIds, ...eligibleLecturers.map((item) => item.id)])
      ),
    }));
  const addAllEligibleLabAssistants = () =>
    setForm((p) => ({
      ...p,
      assignedLabAssistantIds: Array.from(
        new Set([
          ...p.assignedLabAssistantIds,
          ...eligibleLabAssistants.map((item) => item.id),
        ])
      ),
    }));

  const saveOffering = async () => {
    if (!modalMode) return;
    if (!form.facultyId || !form.degreeProgramId || !form.intakeId || !form.termCode || !form.moduleId) {
      toast({ title: "Failed", message: "Faculty, degree, intake, term, and module are required", variant: "error" });
      return;
    }

    setIsSaving(true);
    try {
      const payload = { facultyCode: form.facultyId, degreeCode: form.degreeProgramId, intakeName: form.intakeId, termCode: form.termCode, moduleCode: form.moduleId, syllabusVersion: form.syllabusVersion, status: form.status, assignedLecturerIds: form.assignedLecturerIds, assignedLabAssistantIds: form.assignedLabAssistantIds };
      if (modalMode === "add") {
        await readJson<unknown>(await fetch("/api/module-offerings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
      } else {
        if (!editTarget) return;
        await readJson<unknown>(await fetch(`/api/module-offerings/${encodeURIComponent(editTarget.id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
      }
      toast({ title: "Saved", message: modalMode === "add" ? "Module offering created" : "Module offering updated", variant: "success" });
      closeModal();
      await loadOfferings();
    } catch (error) {
      toast({ title: "Failed", message: error instanceof Error ? error.message : "Failed to save module offering", variant: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await readJson<unknown>(await fetch(`/api/module-offerings/${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" }));
      toast({ title: "Deleted", message: "Module offering deleted", variant: "success" });
      setDeleteTarget(null);
      await loadOfferings();
    } catch (error) {
      toast({ title: "Failed", message: error instanceof Error ? error.message : "Failed to delete module offering", variant: "error" });
    } finally {
      setIsDeleting(false);
    }
  };

  const modalDegreeOptions = useMemo(() => modalDegrees.filter((d) => !form.facultyId || d.facultyCode === form.facultyId), [modalDegrees, form.facultyId]);
  const modalIntakeOptions = useMemo(() => modalIntakes.filter((i) => (!form.facultyId || i.facultyCode === form.facultyId) && (!form.degreeProgramId || i.degreeCode === form.degreeProgramId)), [modalIntakes, form.facultyId, form.degreeProgramId]);
  const contextLecturers = useMemo(() => [...eligibleLecturers, ...(editTarget?.lecturers ?? [])], [eligibleLecturers, editTarget]);
  const contextLab = useMemo(() => [...eligibleLabAssistants, ...(editTarget?.labAssistants ?? [])], [eligibleLabAssistants, editTarget]);
  const quickAssignLecturerLookup = useMemo(
    () =>
      new Map(
        [...(quickAssignTarget?.lecturers ?? []), ...quickAssignEligibleLecturers].map(
          (lecturer) => [lecturer.id, lecturer]
        )
      ),
    [quickAssignEligibleLecturers, quickAssignTarget]
  );
  const quickAssignFilteredLecturers = useMemo(() => {
    const query = quickAssignSearch.trim().toLowerCase();
    const rows = Array.from(quickAssignLecturerLookup.values());
    if (!query) return rows;
    return rows.filter((lecturer) =>
      `${lecturer.fullName} ${lecturer.email}`.toLowerCase().includes(query)
    );
  }, [quickAssignLecturerLookup, quickAssignSearch]);

  return (
    <div className="admin-dashboard space-y-6 lg:space-y-8">
      <div className={cn("flex justify-end", contentBlurClass)}>
        <Button className="h-11 gap-2 px-5" onClick={openAddModal}>
          <Plus size={16} />
          Add Module Offering
        </Button>
      </div>

      <section
        className={cn(
          "grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]",
          contentBlurClass
        )}
      >
        <Card accent className="p-6 lg:p-7">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <Badge variant="neutral">Academic Structure</Badge>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                  Module offering directory
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-text/68">
                  Search, filter, and manage term-based module offerings, lecturer
                  assignments, and lab support using the updated admin surface style.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:items-end">
                <div className="admin-inline-stat rounded-[24px] border border-border bg-card p-4 sm:min-w-[190px]">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                    Visible Results
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-heading">
                    {totalCount.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-text/60">
                    {filtersApplied
                      ? "Matching the current search and filters"
                      : "Showing the full offering directory"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] lg:items-end">
                <div className="min-w-0 flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    Search
                  </label>
                  <div className="group flex h-14 w-full min-w-0 items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                    <span className="mr-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Search size={17} />
                    </span>
                    <input
                      aria-label="Search module offerings"
                      className="h-full min-w-0 flex-1 border-0 bg-transparent pr-2 text-[15px] text-heading outline-none placeholder:text-text/48"
                      onChange={(event) => {
                        setSearchQuery(event.target.value);
                        setPage(1);
                      }}
                      placeholder="Search by module code or name"
                      value={searchQuery}
                    />
                    {searchQuery.trim() ? (
                      <button
                        aria-label="Clear search"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text/45 transition-colors hover:bg-primary/8 hover:text-primary"
                        onClick={() => {
                          setSearchQuery("");
                          setPage(1);
                        }}
                        type="button"
                      >
                        <X size={15} />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="min-w-0 flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    Sort
                  </label>
                  <div className="group relative flex h-14 w-full items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                    <span className="mr-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <ArrowUpDown size={16} />
                    </span>
                    <select
                      aria-label="Sort module offerings"
                      className="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent pr-8 text-[15px] text-heading outline-none"
                      onChange={(event) => {
                        setSortBy(event.target.value as SortOption);
                        setPage(1);
                      }}
                      value={sortBy}
                    >
                      <option value="updated">Recently Updated</option>
                      <option value="module">Module Code</option>
                      <option value="term">Term</option>
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text/45"
                      size={17}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <div className="min-w-0 flex flex-col gap-2 xl:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    Faculty
                  </label>
                  <div className="relative flex h-14 min-w-0 items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                    <select
                      aria-label="Filter by faculty"
                      className="h-full w-full appearance-none border-0 bg-transparent pr-8 text-[15px] text-heading outline-none"
                      onChange={(event) => {
                        setFacultyFilter(code(event.target.value));
                        setPage(1);
                      }}
                      value={facultyFilter}
                    >
                      <option value="">All faculties</option>
                      {faculties.map((faculty) => (
                        <option key={faculty.code} value={faculty.code}>
                          {faculty.code}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text/45"
                      size={17}
                    />
                  </div>
                </div>

                <div className="min-w-0 flex flex-col gap-2 xl:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    Degree
                  </label>
                  <div className="relative flex h-14 min-w-0 items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                    <select
                      aria-label="Filter by degree"
                      className="h-full w-full appearance-none border-0 bg-transparent pr-8 text-[15px] text-heading outline-none disabled:cursor-not-allowed disabled:text-text/45"
                      disabled={!facultyFilter}
                      onChange={(event) => {
                        setDegreeFilter(code(event.target.value));
                        setPage(1);
                      }}
                      value={degreeFilter}
                    >
                      <option value="">All degrees</option>
                      {filterDegrees
                        .filter((degree) => !facultyFilter || degree.facultyCode === facultyFilter)
                        .map((degree) => (
                          <option key={degree.code} value={degree.code}>
                            {degree.code}
                          </option>
                        ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text/45"
                      size={17}
                    />
                  </div>
                </div>

                <div className="min-w-0 flex flex-col gap-2 xl:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    Intake
                  </label>
                  <div className="relative flex h-14 min-w-0 items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                    <select
                      aria-label="Filter by intake"
                      className="h-full w-full appearance-none border-0 bg-transparent pr-8 text-[15px] text-heading outline-none disabled:cursor-not-allowed disabled:text-text/45"
                      disabled={!degreeFilter}
                      onChange={(event) => {
                        setIntakeFilter(sid(event.target.value));
                        setPage(1);
                      }}
                      value={intakeFilter}
                    >
                      <option value="">All intakes</option>
                      {filterIntakes
                        .filter(
                          (intake) =>
                            (!facultyFilter || intake.facultyCode === facultyFilter) &&
                            (!degreeFilter || intake.degreeCode === degreeFilter)
                        )
                        .map((intake) => (
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

                <div className="min-w-0 flex flex-col gap-2 xl:col-span-3">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] leading-[1.2] text-text/60">
                    Semester / Term
                  </label>
                  <div className="relative flex h-14 min-w-0 items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                    <select
                      aria-label="Filter by term"
                      className="h-full w-full appearance-none border-0 bg-transparent pr-8 text-[15px] text-heading outline-none"
                      onChange={(event) => {
                        setTermFilter(String(event.target.value ?? "").trim().toUpperCase() as "" | TermCode);
                        setPage(1);
                      }}
                      value={termFilter}
                    >
                      <option value="">All terms</option>
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

                <div className="min-w-0 flex flex-col gap-2 xl:col-span-3">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    Status
                  </label>
                  <div className="relative flex h-14 min-w-0 items-center rounded-[22px] border border-[rgba(180,190,220,0.44)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,253,0.92)_100%)] px-4 shadow-[0_12px_28px_rgba(15,23,41,0.05)] transition-all focus-within:-translate-y-0.5 focus-within:border-[rgba(52,97,255,0.28)] focus-within:shadow-[0_18px_36px_rgba(52,97,255,0.10)]">
                    <select
                      aria-label="Filter by offering status"
                      className="h-full w-full appearance-none border-0 bg-transparent pr-8 text-[15px] text-heading outline-none"
                      onChange={(event) => {
                        setStatusFilter(event.target.value as "" | OfferingStatus);
                        setPage(1);
                      }}
                      value={statusFilter}
                    >
                      <option value="">All statuses</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text/45"
                      size={17}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={activeFilterCount > 0 ? "primary" : "neutral"}>
                {activeFilterCount > 0 ? `${activeFilterCount} filters applied` : "No extra filters"}
              </Badge>
              <Badge variant="neutral">{SORT_LABELS[sortBy]}</Badge>
              {searchQuery.trim() ? (
                <Badge
                  className="max-w-[260px] overflow-hidden text-ellipsis whitespace-nowrap"
                  variant="primary"
                >
                  Search: {searchQuery.trim()}
                </Badge>
              ) : null}
              {filtersApplied ? (
                <Button className="h-9 px-3 text-xs" onClick={resetFilters} variant="ghost">
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </Card>

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

      <Card className={cn("overflow-hidden p-0 transition-all", contentBlurClass)}>
        <div className="flex flex-col gap-4 border-b border-border px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-lg font-semibold text-heading">Module Offering Records</p>
            <p className="mt-1 text-sm text-text/68">
              Review academic ownership, term delivery, lecturer links, and lab support
              from a cleaner table surface.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={activeFilterCount > 0 ? "primary" : "neutral"}>
              {activeFilterCount > 0 ? `${activeFilterCount} filters applied` : "No extra filters"}
            </Badge>
            <Badge variant="neutral">{SORT_LABELS[sortBy]}</Badge>
            {searchQuery.trim() ? (
              <Badge
                className="max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap"
                variant="primary"
              >
                Search: {searchQuery.trim()}
              </Badge>
            ) : null}
            {filtersApplied ? (
              <Button className="h-9 px-3 text-xs" onClick={resetFilters} variant="ghost">
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        <div className="hidden border-b border-border px-6 py-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(6,minmax(0,1fr))_220px]">
            <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">Search</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/50" size={16} /><Input className="h-12 pl-10" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} placeholder="Search module code or name" /></div></div>
            <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">Faculty</label><Select className="h-12" value={facultyFilter} onChange={(e) => { setFacultyFilter(code(e.target.value)); setPage(1); }}><option value="">All</option>{faculties.map((f) => <option key={f.code} value={f.code}>{f.code}</option>)}</Select></div>
            <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">Degree</label><Select className="h-12" disabled={!facultyFilter} value={degreeFilter} onChange={(e) => { setDegreeFilter(code(e.target.value)); setPage(1); }}><option value="">All</option>{filterDegrees.filter((d) => !facultyFilter || d.facultyCode === facultyFilter).map((d) => <option key={d.code} value={d.code}>{d.code}</option>)}</Select></div>
            <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">Intake</label><Select className="h-12" disabled={!degreeFilter} value={intakeFilter} onChange={(e) => { setIntakeFilter(sid(e.target.value)); setPage(1); }}><option value="">All</option>{filterIntakes.filter((i) => (!facultyFilter || i.facultyCode === facultyFilter) && (!degreeFilter || i.degreeCode === degreeFilter)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select></div>
            <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">Semester / Term</label><Select className="h-12" value={termFilter} onChange={(e) => { setTermFilter(String(e.target.value ?? "").trim().toUpperCase() as "" | TermCode); setPage(1); }}><option value="">All</option>{TERM_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}</Select></div>
            <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">Status</label><Select className="h-12" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as "" | OfferingStatus); setPage(1); }}><option value="">All</option><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></Select></div>
            <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">Sort</label><Select className="h-12" value={sortBy} onChange={(e) => { setSortBy(e.target.value as SortOption); setPage(1); }}><option value="updated">Recently Updated</option><option value="module">Module Code</option><option value="term">Term</option></Select></div>
            <div className="rounded-2xl border border-border bg-tint px-4 py-3"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">Total Offerings</p><p className="mt-1 text-2xl font-semibold text-heading">{totalCount}</p></div>
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6 sm:py-6">
          <div className="overflow-hidden rounded-[28px] border border-border bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1540px] text-left text-sm">
                <thead className="bg-[rgba(255,255,255,0.82)]">
                  <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                    <th className="px-5 py-4">Module</th>
                    <th className="px-5 py-4">Faculty</th>
                    <th className="px-5 py-4">Degree</th>
                    <th className="px-5 py-4">Intake</th>
                    <th className="px-5 py-4">Semester / Term</th>
                    <th className="px-5 py-4">Syllabus</th>
                    <th className="px-5 py-4">Lecturers</th>
                    <th className="px-5 py-4">Lab Assistants</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Last Updated</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {isLoading ? (
                    <tr>
                      <td className="px-5 py-12 text-center text-sm text-text/68" colSpan={11}>
                        Loading module offerings...
                      </td>
                    </tr>
                  ) : null}
                  {!isLoading
                    ? items.map((item) => {
                        const visibleLecturers = item.lecturers.slice(0, 2);
                        const visibleLabAssistants = item.labAssistants.slice(0, 2);

                        return (
                          <tr
                            className="transition-colors duration-200 hover:bg-white/70"
                            key={item.id}
                          >
                            <td className="px-5 py-4 align-top">
                              <div>
                                <p className="font-semibold text-heading">{item.moduleCode}</p>
                                <p className="mt-1 text-text/78">{item.moduleName}</p>
                                <p className="mt-1 text-xs text-text/55">
                                  Updated {fmtDate(item.updatedAt)}
                                </p>
                              </div>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <p className="font-medium text-heading">{item.facultyId || "-"}</p>
                              <p className="mt-1 text-xs text-text/55">
                                {item.facultyName || "Owning faculty"}
                              </p>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <p className="font-medium text-heading">
                                {item.degreeProgramId || "-"}
                              </p>
                              <p className="mt-1 text-xs text-text/55">
                                {item.degreeProgramName || "Degree program"}
                              </p>
                            </td>
                            <td className="px-5 py-4 align-top text-text/78">
                              {item.intakeName || item.intakeId}
                            </td>
                            <td className="px-5 py-4 align-top text-text/78">
                              {item.termCode || "-"}
                            </td>
                            <td className="px-5 py-4 align-top">
                              <div className="space-y-1.5">
                                <Badge
                                  variant={
                                    item.syllabusVersion === "OLD" ? "warning" : "primary"
                                  }
                                >
                                  {item.syllabusVersion}
                                </Badge>
                                <p className="text-xs text-text/55">
                                  {item.syllabusVersion === "OLD"
                                    ? "Previous syllabus version"
                                    : "Current syllabus version"}
                                </p>
                              </div>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <p className="font-semibold text-heading">
                                {item.lecturers.length}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {visibleLecturers.map((lecturer) => (
                                  <span
                                    className="rounded-full border border-border bg-tint px-2 py-0.5 text-xs text-text/70"
                                    key={lecturer.id}
                                  >
                                    {lecturer.fullName}
                                  </span>
                                ))}
                                {item.lecturers.length > 2 ? (
                                  <span className="rounded-full border border-border bg-white px-2 py-0.5 text-xs font-semibold text-text/70">
                                    +{item.lecturers.length - 2}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <p className="font-semibold text-heading">
                                {item.labAssistants.length}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {visibleLabAssistants.map((assistant) => (
                                  <span
                                    className="rounded-full border border-border bg-tint px-2 py-0.5 text-xs text-text/70"
                                    key={assistant.id}
                                  >
                                    {assistant.fullName}
                                  </span>
                                ))}
                                {item.labAssistants.length > 2 ? (
                                  <span className="rounded-full border border-border bg-white px-2 py-0.5 text-xs font-semibold text-text/70">
                                    +{item.labAssistants.length - 2}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <div className="space-y-1.5">
                                <Badge variant={item.status === "ACTIVE" ? "success" : "neutral"}>
                                  {item.status}
                                </Badge>
                                <p className="text-xs text-text/55">
                                  {item.status === "ACTIVE"
                                    ? "Visible in the active academic setup"
                                    : "Hidden from active academic setup"}
                                </p>
                              </div>
                            </td>
                            <td className="px-5 py-4 align-top text-text/78">
                              {fmtDate(item.updatedAt)}
                            </td>
                            <td className="px-5 py-4 align-top">
                              <div className="flex justify-end gap-2">
                                <button
                                  aria-label={`Assign lecturers for ${item.moduleCode} offering`}
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white/75 text-text/70 shadow-[0_8px_20px_rgba(15,23,41,0.04)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-heading hover:shadow-shadow"
                                  onClick={() => openQuickAssignModal(item)}
                                  type="button"
                                >
                                  <Plus size={16} />
                                </button>
                                <button
                                  aria-label={`Edit ${item.moduleCode} offering`}
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white/75 text-text/70 shadow-[0_8px_20px_rgba(15,23,41,0.04)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-heading hover:shadow-shadow"
                                  onClick={() => openEditModal(item)}
                                  type="button"
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  aria-label={`Delete ${item.moduleCode} offering`}
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white/75 text-text/70 shadow-[0_8px_20px_rgba(15,23,41,0.04)] transition-all hover:-translate-y-0.5 hover:border-red-200 hover:bg-white hover:text-red-600 hover:shadow-shadow"
                                  onClick={() => setDeleteTarget(item)}
                                  type="button"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    : null}

                  {!isLoading && items.length === 0 ? (
                    <tr>
                      <td className="px-5 py-12 text-center text-sm text-text/68" colSpan={11}>
                        No module offerings match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <TablePagination
          className="mt-0 px-6 pb-6"
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value as PageSize);
            setPage(1);
          }}
          page={safePage}
          pageCount={pageCount}
          pageSize={pageSize}
          totalItems={totalCount}
        />
      </Card>

      <EditOfferingModal
        open={isModalOpen}
        mode={modalMode ?? "add"}
        saving={isSaving}
        loadingModules={isLoadingModules}
        loadingModuleAssignments={isLoadingModuleAssignments}
        loadingLecturers={isLoadingLecturers}
        loadingLabAssistants={isLoadingLabAssistants}
        offering={editTarget ? { ...editTarget, lecturers: editTarget.lecturers.map((r) => ({ ...r, fullName: staffChipLabel(contextLecturers, r.id) })), labAssistants: editTarget.labAssistants.map((r) => ({ ...r, fullName: staffChipLabel(contextLab, r.id) })) } : null}
        form={form}
        facultyOptions={faculties}
        degreeOptions={modalDegreeOptions}
        intakeOptions={modalIntakeOptions}
        moduleOptions={modalModules}
        termOptions={TERM_OPTIONS}
        moduleAssignments={moduleAssignments}
        eligibleLecturers={eligibleLecturers}
        eligibleLabAssistants={eligibleLabAssistants}
        onFacultyChange={handleFacultyChange}
        onDegreeChange={handleDegreeChange}
        onIntakeChange={(v) => setForm((p) => ({ ...p, intakeId: sid(v) }))}
        onTermChange={handleTermChange}
        onModuleChange={handleModuleChange}
        onSyllabusVersionChange={(v) => setForm((p) => ({ ...p, syllabusVersion: v }))}
        onStatusChange={(v) => setForm((p) => ({ ...p, status: v }))}
        onToggleLecturer={toggleLecturer}
        onToggleLabAssistant={toggleLab}
        onAddAllLecturers={addAllEligibleLecturers}
        onAddAllLabAssistants={addAllEligibleLabAssistants}
        onClose={closeModal}
        onSave={() => { void saveOffering(); }}
      />

      {quickAssignTarget ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSavingQuickAssign) closeQuickAssignModal(); }} role="presentation">
          <div aria-modal="true" className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_56px_rgba(15,23,42,0.22)]" role="dialog">
            <div className="overflow-y-auto px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">ASSIGN</p>
                  <p className="mt-1 text-2xl font-semibold text-heading">Assign Lecturers</p>
                  <p className="mt-1 text-sm text-text/70">{quickAssignTarget.moduleCode} / {quickAssignTarget.intakeName || quickAssignTarget.intakeId} / {quickAssignTarget.termCode}</p>
                </div>
                <button className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-text/70 hover:bg-tint hover:text-heading disabled:cursor-not-allowed disabled:opacity-60" disabled={isSavingQuickAssign} onClick={closeQuickAssignModal} type="button"><X size={16} /></button>
              </div>

              <div className="mt-5 rounded-2xl border border-border bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-heading">Selected Lecturers</p>
                  <Badge variant="primary">{quickAssignSelectedLecturerIds.length}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {quickAssignSelectedLecturerIds.length === 0 ? (
                    <p className="text-sm text-text/65">No lecturers assigned.</p>
                  ) : (
                    quickAssignSelectedLecturerIds.map((lecturerId) => (
                      <button className="inline-flex items-center gap-2 rounded-full border border-border bg-tint px-3 py-1 text-xs font-semibold text-heading hover:bg-slate-200" key={lecturerId} onClick={() => toggleQuickAssignLecturer(lecturerId)} type="button">
                        {quickAssignLecturerLookup.get(lecturerId)?.fullName ?? lecturerId}
                        <X size={12} />
                      </button>
                    ))
                  )}
                </div>

                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/55" size={14} />
                  <Input className="h-10 pl-8" onChange={(event) => setQuickAssignSearch(event.target.value)} placeholder="Search lecturers" value={quickAssignSearch} />
                </div>

                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {isLoadingQuickAssignLecturers ? (
                    <p className="rounded-xl border border-border bg-tint px-3 py-2 text-sm text-text/68">Loading lecturers...</p>
                  ) : quickAssignFilteredLecturers.length === 0 ? (
                    <p className="rounded-xl border border-border bg-tint px-3 py-2 text-sm text-text/68">No lecturers found.</p>
                  ) : (
                    quickAssignFilteredLecturers.map((lecturer) => (
                      <label className="inline-flex w-full items-start gap-2 rounded-xl border border-border bg-tint px-2.5 py-2 text-sm text-heading" key={lecturer.id}>
                        <input checked={quickAssignSelectedLecturerIds.includes(lecturer.id)} className="mt-0.5 h-4 w-4 rounded border-border" disabled={isSavingQuickAssign} onChange={() => toggleQuickAssignLecturer(lecturer.id)} type="checkbox" />
                        <span>
                          <span className="font-semibold">{lecturer.fullName}</span>
                          <span className="block text-xs text-text/60">{lecturer.email}</span>
                          <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-text/58">{lecturer.status || "ACTIVE"}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-white px-6 py-4">
              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <Button className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50" disabled={isSavingQuickAssign} onClick={closeQuickAssignModal} variant="secondary">Cancel</Button>
                <Button className="h-11 min-w-[132px] gap-2 bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]" disabled={isSavingQuickAssign} onClick={() => { void saveQuickAssign(); }}>{isSavingQuickAssign ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}Save</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDeleteOfferingModal
        open={Boolean(deleteTarget)}
        deleting={isDeleting}
        title="Delete module offering?"
        message="This will remove the selected module offering and its lecturer/lab assistant assignments."
        targetLabel={deleteTarget ? `${deleteTarget.moduleCode} / ${deleteTarget.intakeName || deleteTarget.intakeId} / ${deleteTarget.termCode}` : ""}
        onClose={() => { if (!isDeleting) setDeleteTarget(null); }}
        onConfirm={() => { void confirmDelete(); }}
      />

      {isSaving || isDeleting || isSavingQuickAssign ? <div className="pointer-events-none fixed bottom-4 left-4 z-[98] inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-xs font-semibold text-text/70 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"><Loader2 className="animate-spin" size={14} />Processing...</div> : null}
    </div>
  );
}

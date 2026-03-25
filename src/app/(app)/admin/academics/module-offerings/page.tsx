"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAdminContext } from "@/components/admin/AdminContext";
import PageHeader from "@/components/admin/PageHeader";
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

interface DegreeOption extends OfferingDegreeOption { facultyCode: string }
interface IntakeOption extends OfferingIntakeOption { facultyCode: string; degreeCode: string }
interface OfferingRecord extends EditOfferingContext { createdAt: string; updatedAt: string }

const TERM_OPTIONS: TermCode[] = ["Y1S1", "Y1S2", "Y2S1", "Y2S2", "Y3S1", "Y3S2", "Y4S1", "Y4S2"];

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

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) {
    const msg = payload && typeof payload === "object" && "message" in payload ? payload.message : "Request failed";
    throw new Error(msg || "Request failed");
  }
  return (payload ?? ({} as T)) as T;
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
  const [eligibleLecturers, setEligibleLecturers] = useState<OfferingStaffItem[]>([]);
  const [eligibleLabAssistants, setEligibleLabAssistants] = useState<OfferingStaffItem[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<OfferingRecord | null>(null);

  const deferredSearch = useDeferredValue(searchQuery);
  const isModalOpen = Boolean(modalMode);
  const isOverlayOpen = Boolean(isModalOpen || deleteTarget);

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
    if (modalMode === "add") { setActiveWindow("Create"); return; }
    if (modalMode === "edit") { setActiveWindow("Edit"); return; }
    setActiveWindow("List");
  }, [modalMode, setActiveWindow]);

  useEffect(() => () => setActiveWindow(null), [setActiveWindow]);

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, pageCount);

  const closeModal = () => {
    if (isSaving) return;
    setModalMode(null); setEditTarget(null); setForm(emptyForm()); setModalDegrees([]); setModalIntakes([]); setModalModules([]); setEligibleLecturers([]); setEligibleLabAssistants([]);
  };

  const openAddModal = () => { setModalMode("add"); setEditTarget(null); setForm(emptyForm()); setModalDegrees([]); setModalIntakes([]); setModalModules([]); setEligibleLecturers([]); setEligibleLabAssistants([]); };

  const openEditModal = (offering: OfferingRecord) => {
    setModalMode("edit");
    setEditTarget(offering);
    setForm({ facultyId: offering.facultyId, degreeProgramId: offering.degreeProgramId, intakeId: offering.intakeId, termCode: offering.termCode, moduleId: offering.moduleId, syllabusVersion: offering.syllabusVersion, status: offering.status, assignedLecturerIds: offering.lecturers.map((r) => r.id), assignedLabAssistantIds: offering.labAssistants.map((r) => r.id) });
    setModalDegrees([]); setModalIntakes([]); setModalModules([]); setEligibleLecturers([]); setEligibleLabAssistants([]);
    void loadDegrees(offering.facultyId).then(setModalDegrees).catch(() => setModalDegrees([]));
    void loadIntakes(offering.facultyId, offering.degreeProgramId).then(setModalIntakes).catch(() => setModalIntakes([]));
    setIsLoadingModules(true);
    void loadModules(offering.facultyId, offering.degreeProgramId, offering.termCode).then(setModalModules).catch(() => setModalModules([])).finally(() => setIsLoadingModules(false));
    void loadEligible("lecturers", offering.facultyId, offering.degreeProgramId, offering.moduleId);
    void loadEligible("lab-assistants", offering.facultyId, offering.degreeProgramId, offering.moduleId);
  };

  const handleFacultyChange = (value: string) => {
    const facultyId = code(value);
    setForm((p) => ({ ...p, facultyId, degreeProgramId: "", intakeId: "", moduleId: "", assignedLecturerIds: [], assignedLabAssistantIds: [] }));
    setModalDegrees([]); setModalIntakes([]); setModalModules([]); setEligibleLecturers([]); setEligibleLabAssistants([]);
    if (facultyId) void loadDegrees(facultyId).then(setModalDegrees).catch(() => setModalDegrees([]));
  };

  const handleDegreeChange = (value: string) => {
    const degreeProgramId = code(value);
    setForm((p) => ({ ...p, degreeProgramId, intakeId: "", moduleId: "", assignedLecturerIds: [], assignedLabAssistantIds: [] }));
    setModalIntakes([]); setModalModules([]); setEligibleLecturers([]); setEligibleLabAssistants([]);
    if (!form.facultyId || !degreeProgramId) return;
    void loadIntakes(form.facultyId, degreeProgramId).then(setModalIntakes).catch(() => setModalIntakes([]));
    setIsLoadingModules(true);
    void loadModules(form.facultyId, degreeProgramId, form.termCode).then(setModalModules).catch(() => setModalModules([])).finally(() => setIsLoadingModules(false));
  };

  const handleTermChange = (value: string) => {
    const termCode = String(value ?? "").trim().toUpperCase();
    setForm((p) => ({ ...p, termCode, moduleId: "", assignedLecturerIds: [], assignedLabAssistantIds: [] }));
    setModalModules([]); setEligibleLecturers([]); setEligibleLabAssistants([]);
    if (!form.facultyId || !form.degreeProgramId || !termCode) return;
    setIsLoadingModules(true);
    void loadModules(form.facultyId, form.degreeProgramId, termCode).then(setModalModules).catch(() => setModalModules([])).finally(() => setIsLoadingModules(false));
  };

  const handleModuleChange = (value: string) => {
    const moduleId = sid(value);
    const selected = modalModules.find((m) => m.id === moduleId) ?? null;
    setForm((p) => ({ ...p, moduleId, assignedLecturerIds: [], assignedLabAssistantIds: [], syllabusVersion: modalMode === "add" && selected ? selected.defaultSyllabusVersion : p.syllabusVersion }));
    if (!form.facultyId || !form.degreeProgramId || !moduleId) { setEligibleLecturers([]); setEligibleLabAssistants([]); return; }
    void loadEligible("lecturers", form.facultyId, form.degreeProgramId, moduleId);
    void loadEligible("lab-assistants", form.facultyId, form.degreeProgramId, moduleId);
  };

  const toggleLecturer = (id: string) => setForm((p) => ({ ...p, assignedLecturerIds: p.assignedLecturerIds.includes(id) ? p.assignedLecturerIds.filter((x) => x !== id) : [...p.assignedLecturerIds, id] }));
  const toggleLab = (id: string) => setForm((p) => ({ ...p, assignedLabAssistantIds: p.assignedLabAssistantIds.includes(id) ? p.assignedLabAssistantIds.filter((x) => x !== id) : [...p.assignedLabAssistantIds, id] }));

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

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        actions={<Button className="h-11 min-w-[188px] justify-center gap-2 rounded-2xl bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]" onClick={openAddModal}><Plus size={16} />Add Module Offering</Button>}
        description="Assign lecturers and lab assistants to term-based module offerings."
        title="Module Offerings"
      />

      <Card className={isOverlayOpen ? "pointer-events-none opacity-45 blur-[1px] transition-all" : "transition-all"}>
        <div className="flex flex-col gap-4 border-b border-border pb-5">
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

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1540px] text-left text-sm">
            <thead className="border-b border-border bg-tint"><tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60"><th className="px-4 py-3">Module</th><th className="px-4 py-3">Faculty</th><th className="px-4 py-3">Degree</th><th className="px-4 py-3">Intake</th><th className="px-4 py-3">Semester / Term</th><th className="px-4 py-3">Syllabus</th><th className="px-4 py-3">Lecturers</th><th className="px-4 py-3">Lab Assistants</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last Updated</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody>
              {isLoading ? <tr><td className="px-4 py-10 text-center text-sm text-text/68" colSpan={11}>Loading module offerings...</td></tr> : null}
              {!isLoading && items.length === 0 ? <tr><td className="px-4 py-10 text-center text-sm text-text/68" colSpan={11}>No module offerings match the current filters.</td></tr> : null}
              {!isLoading ? items.map((item) => {
                const l2 = item.lecturers.slice(0, 2); const a2 = item.labAssistants.slice(0, 2);
                return <tr className="border-b border-border/70 hover:bg-tint" key={item.id}>
                  <td className="px-4 py-4"><p className="font-semibold text-heading">{item.moduleCode}</p><p className="text-text/78">{item.moduleName}</p><p className="mt-1 text-xs text-text/60">Updated {fmtDate(item.updatedAt)}</p></td>
                  <td className="px-4 py-4 text-text/78">{item.facultyId || "—"}</td><td className="px-4 py-4 text-text/78">{item.degreeProgramId || "—"}</td><td className="px-4 py-4 text-text/78">{item.intakeName || item.intakeId}</td><td className="px-4 py-4 text-text/78">{item.termCode || "—"}</td>
                  <td className="px-4 py-4"><Badge variant={item.syllabusVersion === "OLD" ? "warning" : "primary"}>{item.syllabusVersion}</Badge></td>
                  <td className="px-4 py-4 text-text/78"><p className="font-semibold text-heading">{item.lecturers.length}</p><div className="mt-1 flex flex-wrap gap-1.5">{l2.map((x) => <span key={x.id} className="rounded-full border border-border bg-tint px-2 py-0.5 text-xs text-text/70">{x.fullName}</span>)}{item.lecturers.length > 2 ? <span className="rounded-full border border-border bg-white px-2 py-0.5 text-xs font-semibold text-text/70">+{item.lecturers.length - 2}</span> : null}</div></td>
                  <td className="px-4 py-4 text-text/78"><p className="font-semibold text-heading">{item.labAssistants.length}</p><div className="mt-1 flex flex-wrap gap-1.5">{a2.map((x) => <span key={x.id} className="rounded-full border border-border bg-tint px-2 py-0.5 text-xs text-text/70">{x.fullName}</span>)}{item.labAssistants.length > 2 ? <span className="rounded-full border border-border bg-white px-2 py-0.5 text-xs font-semibold text-text/70">+{item.labAssistants.length - 2}</span> : null}</div></td>
                  <td className="px-4 py-4"><Badge variant={item.status === "ACTIVE" ? "success" : "neutral"}>{item.status}</Badge></td>
                  <td className="px-4 py-4 text-text/70">{fmtDate(item.updatedAt)}</td>
                  <td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/70 hover:bg-tint hover:text-heading" aria-label={`Edit ${item.moduleCode} offering`} onClick={() => openEditModal(item)}><Pencil size={16} /></button><button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/70 hover:bg-tint hover:text-heading" aria-label={`Delete ${item.moduleCode} offering`} onClick={() => setDeleteTarget(item)}><Trash2 size={16} /></button></div></td>
                </tr>;
              }) : null}
            </tbody>
          </table>
        </div>

        <TablePagination page={safePage} pageCount={pageCount} pageSize={pageSize} totalItems={totalCount} onPageChange={setPage} onPageSizeChange={(v) => { setPageSize(v as PageSize); setPage(1); }} />
      </Card>

      <EditOfferingModal
        open={isModalOpen}
        mode={modalMode ?? "add"}
        saving={isSaving}
        loadingModules={isLoadingModules}
        loadingLecturers={isLoadingLecturers}
        loadingLabAssistants={isLoadingLabAssistants}
        offering={editTarget ? { ...editTarget, lecturers: editTarget.lecturers.map((r) => ({ ...r, fullName: staffChipLabel(contextLecturers, r.id) })), labAssistants: editTarget.labAssistants.map((r) => ({ ...r, fullName: staffChipLabel(contextLab, r.id) })) } : null}
        form={form}
        facultyOptions={faculties}
        degreeOptions={modalDegreeOptions}
        intakeOptions={modalIntakeOptions}
        moduleOptions={modalModules}
        termOptions={TERM_OPTIONS}
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
        onClose={closeModal}
        onSave={() => { void saveOffering(); }}
      />

      <ConfirmDeleteOfferingModal
        open={Boolean(deleteTarget)}
        deleting={isDeleting}
        title="Delete module offering?"
        message="This will remove the selected module offering and its lecturer/lab assistant assignments."
        targetLabel={deleteTarget ? `${deleteTarget.moduleCode} / ${deleteTarget.intakeName || deleteTarget.intakeId} / ${deleteTarget.termCode}` : ""}
        onClose={() => { if (!isDeleting) setDeleteTarget(null); }}
        onConfirm={() => { void confirmDelete(); }}
      />

      {isSaving || isDeleting ? <div className="pointer-events-none fixed bottom-4 left-4 z-[98] inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-xs font-semibold text-text/70 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"><Loader2 className="animate-spin" size={14} />Processing...</div> : null}
    </div>
  );
}

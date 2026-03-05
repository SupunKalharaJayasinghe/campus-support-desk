"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Unlink2,
  X,
} from "lucide-react";
import { useAdminContext } from "@/components/admin/AdminContext";
import PageHeader from "@/components/admin/PageHeader";
import TablePagination from "@/components/admin/TablePagination";
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
type SortOption = "updated" | "created" | "az" | "za";
type PageSize = 10 | 25 | 50 | 100;

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
  createdAt: string;
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

interface ModuleModalState {
  mode: "add" | "edit";
  targetId?: string;
}

interface ModuleDependencyItem {
  offeringId: string;
  facultyCode: string;
  facultyName: string;
  degreeId: string;
  degreeCode: string;
  intakeId: string;
  intakeName: string;
  termCode: string;
  syllabusVersion: string;
  lecturerCount: number;
  updatedAt: string;
}

interface ModuleDependenciesResponse {
  moduleId: string;
  totalOfferings: number;
  items: ModuleDependencyItem[];
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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeModuleCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

function normalizeAcademicCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
}

function normalizeSyllabusVersion(value: unknown): SyllabusVersion {
  return value === "OLD" ? "OLD" : "NEW";
}

function normalizeOutlineType(value: unknown): ModuleOutlineTemplateItem["type"] {
  if (value === "MID") return "MID";
  if (value === "QUIZ") return "QUIZ";
  if (value === "LAB") return "LAB";
  if (value === "OTHER") return "OTHER";
  return "LECTURE";
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toISOString().slice(0, 10);
}

function toIsoDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString();
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

function parseModules(payload: unknown): ModuleRecord[] {
  const root = asObject(payload);
  const items = Array.isArray(root?.items) ? (root.items as unknown[]) : [];

  return items
    .map((item) => {
      const row = asObject(item);
      if (!row) {
        return null;
      }

      const id = String(row.id ?? "").trim();
      const code = normalizeModuleCode(String(row.code ?? ""));
      if (!id || !code) {
        return null;
      }

      const outlineTemplate: ModuleOutlineTemplateItem[] = Array.isArray(
        row.outlineTemplate
      )
        ? row.outlineTemplate.reduce<ModuleOutlineTemplateItem[]>((acc, entry) => {
            const outlineRow = asObject(entry);
            if (!outlineRow) {
              return acc;
            }

            const weekNo = Math.max(
              1,
              Math.min(60, Math.floor(Number(outlineRow.weekNo) || 1))
            );
            const title = String(outlineRow.title ?? "").trim();
            if (!title) {
              return acc;
            }

            acc.push({
              weekNo,
              title,
              type: normalizeOutlineType(outlineRow.type),
            });
            return acc;
          }, [])
        : [];

      return {
        id,
        code,
        name: String(row.name ?? "").trim(),
        credits: Math.max(0, Number(row.credits) || 0),
        facultyCode: normalizeAcademicCode(String(row.facultyCode ?? "")),
        applicableTerms: Array.isArray(row.applicableTerms)
          ? row.applicableTerms
              .map((term) => String(term ?? "").toUpperCase())
              .filter((term): term is TermCode => TERM_SEQUENCE.includes(term as TermCode))
          : [],
        applicableDegrees: Array.isArray(row.applicableDegrees)
          ? row.applicableDegrees
              .map((degree) => normalizeAcademicCode(String(degree ?? "")))
              .filter(Boolean)
          : [],
        defaultSyllabusVersion: normalizeSyllabusVersion(row.defaultSyllabusVersion),
        outlineTemplate,
        createdAt: toIsoDate(row.createdAt),
        updatedAt: toIsoDate(row.updatedAt),
      } satisfies ModuleRecord;
    })
    .filter((item): item is ModuleRecord => Boolean(item));
}

function parseFaculties(payload: unknown): FacultyOption[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => {
      const row = asObject(item);
      if (!row) {
        return null;
      }

      const code = normalizeAcademicCode(String(row.code ?? ""));
      if (!code) {
        return null;
      }

      return {
        code,
        name: String(row.name ?? "").trim(),
      } satisfies FacultyOption;
    })
    .filter((item): item is FacultyOption => Boolean(item));
}

function parseDegrees(payload: unknown): DegreeOption[] {
  const root = asObject(payload);
  const items = Array.isArray(root?.items) ? (root.items as unknown[]) : [];

  return items
    .map((item) => {
      const row = asObject(item);
      if (!row) {
        return null;
      }

      const code = normalizeAcademicCode(String(row.code ?? ""));
      const facultyCode = normalizeAcademicCode(String(row.facultyCode ?? ""));
      if (!code || !facultyCode) {
        return null;
      }

      return {
        code,
        name: String(row.name ?? "").trim(),
        facultyCode,
      } satisfies DegreeOption;
    })
    .filter((item): item is DegreeOption => Boolean(item));
}

function parseDependencies(payload: unknown, moduleId: string): ModuleDependenciesResponse {
  const root = asObject(payload);
  const items = Array.isArray(root?.items) ? (root.items as unknown[]) : [];

  const parsedItems = items
    .map((item) => {
      const row = asObject(item);
      if (!row) {
        return null;
      }

      const offeringId = String(row.offeringId ?? "").trim();
      if (!offeringId) {
        return null;
      }

      const updatedAt = toIsoDate(row.updatedAt);
      const lecturerCount = Number(row.lecturerCount);

      return {
        offeringId,
        facultyCode: normalizeAcademicCode(String(row.facultyCode ?? "")),
        facultyName: String(row.facultyName ?? "").trim(),
        degreeId: normalizeAcademicCode(String(row.degreeId ?? row.degreeCode ?? "")),
        degreeCode: normalizeAcademicCode(String(row.degreeCode ?? "")),
        intakeId: String(row.intakeId ?? "").trim(),
        intakeName: String(row.intakeName ?? "").trim(),
        termCode: String(row.termCode ?? "").trim(),
        syllabusVersion: String(row.syllabusVersion ?? "NEW").trim() || "NEW",
        lecturerCount: Number.isFinite(lecturerCount) ? Math.max(0, Math.floor(lecturerCount)) : 0,
        updatedAt,
      } satisfies ModuleDependencyItem;
    })
    .filter((item): item is ModuleDependencyItem => Boolean(item))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const totalOfferings = Number(root?.totalOfferings);

  return {
    moduleId: String(root?.moduleId ?? moduleId).trim() || moduleId,
    totalOfferings: Number.isFinite(totalOfferings)
      ? Math.max(0, Math.floor(totalOfferings))
      : parsedItems.length,
    items: parsedItems,
  };
}

function statusVariant(value: SyllabusVersion) {
  return value === "OLD" ? "warning" : "primary";
}

export default function AdminModulesPage() {
  const { setActiveWindow } = useAdminContext();
  const { toast } = useToast();

  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [faculties, setFaculties] = useState<FacultyOption[]>([]);
  const [degrees, setDegrees] = useState<DegreeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingModule, setIsDeletingModule] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState<ModuleModalState | null>(null);
  const [form, setForm] = useState<ModuleFormState>(emptyFormState);
  const [lockedAssignments, setLockedAssignments] = useState(0);
  const [isLoadingLockedAssignments, setIsLoadingLockedAssignments] = useState(false);

  const [checkingDeleteModuleId, setCheckingDeleteModuleId] = useState<string | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<ModuleRecord | null>(null);
  const [dependencyModalTarget, setDependencyModalTarget] = useState<ModuleRecord | null>(null);
  const [dependencyData, setDependencyData] = useState<ModuleDependenciesResponse | null>(null);
  const [dependencySearch, setDependencySearch] = useState("");
  const [showUnassignAllConfirm, setShowUnassignAllConfirm] = useState(false);
  const [showDependencyDeleteConfirm, setShowDependencyDeleteConfirm] = useState(false);
  const [isUnassigningAll, setIsUnassigningAll] = useState(false);
  const [isUnassigningOfferingId, setIsUnassigningOfferingId] = useState<string | null>(
    null
  );

  const deferredSearch = useDeferredValue(searchQuery);
  const isOverlayOpen = Boolean(
    modal ||
      deleteConfirmTarget ||
      dependencyModalTarget ||
      showUnassignAllConfirm ||
      showDependencyDeleteConfirm
  );

  const loadData = useCallback(
    async (options?: { background?: boolean; silent?: boolean }) => {
      if (!options?.background) {
        setIsLoading(true);
      }

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

        setModules(parseModules(modulePayload));
        setFaculties(parseFaculties(facultyPayload));
        setDegrees(parseDegrees(degreePayload));
      } catch (error) {
        if (!options?.silent) {
          toast({
            title: "Failed",
            message: error instanceof Error ? error.message : "Failed to load modules",
            variant: "error",
          });
        }

        setModules([]);
      } finally {
        if (!options?.background) {
          setIsLoading(false);
        }
      }
    },
    [toast]
  );

  const fetchDependencies = useCallback(async (moduleId: string) => {
    const response = await fetch(
      `/api/modules/${encodeURIComponent(moduleId)}/dependencies`,
      { cache: "no-store" }
    );
    const payload = await readJson<unknown>(response);
    return parseDependencies(payload, moduleId);
  }, []);

  const closeEditModal = useCallback(() => {
    setModal(null);
    setForm(emptyFormState());
    setLockedAssignments(0);
    setIsLoadingLockedAssignments(false);
  }, []);

  const closeDependencyModal = useCallback(() => {
    if (isDeletingModule || isUnassigningAll) {
      return;
    }

    setDependencyModalTarget(null);
    setDependencyData(null);
    setDependencySearch("");
    setShowDependencyDeleteConfirm(false);
    setShowUnassignAllConfirm(false);
    setIsUnassigningOfferingId(null);
  }, [isDeletingModule, isUnassigningAll]);

  const refreshDependencyData = useCallback(async () => {
    if (!dependencyModalTarget) {
      return null;
    }

    const refreshed = await fetchDependencies(dependencyModalTarget.id);
    setDependencyData(refreshed);
    return refreshed;
  }, [dependencyModalTarget, fetchDependencies]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isOverlayOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOverlayOpen]);

  useEffect(() => {
    if (!modal) {
      setActiveWindow("List");
      return;
    }

    setActiveWindow(modal.mode === "add" ? "Create" : "Edit");
  }, [modal, setActiveWindow]);

  useEffect(() => {
    return () => {
      setActiveWindow(null);
    };
  }, [setActiveWindow]);

  useEffect(() => {
    if (!isOverlayOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (showDependencyDeleteConfirm && !isDeletingModule) {
        setShowDependencyDeleteConfirm(false);
        return;
      }

      if (showUnassignAllConfirm && !isUnassigningAll) {
        setShowUnassignAllConfirm(false);
        return;
      }

      if (deleteConfirmTarget && !isDeletingModule) {
        setDeleteConfirmTarget(null);
        return;
      }

      if (
        dependencyModalTarget &&
        !isDeletingModule &&
        !isUnassigningAll &&
        !isUnassigningOfferingId
      ) {
        closeDependencyModal();
        return;
      }

      if (modal && !isSaving) {
        closeEditModal();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    closeDependencyModal,
    closeEditModal,
    deleteConfirmTarget,
    dependencyModalTarget,
    isDeletingModule,
    isOverlayOpen,
    isSaving,
    isUnassigningAll,
    isUnassigningOfferingId,
    modal,
    showDependencyDeleteConfirm,
    showUnassignAllConfirm,
  ]);

  const visibleModules = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    const filtered = modules.filter((module) => {
      if (!query) {
        return true;
      }

      return `${module.code} ${module.name} ${module.facultyCode}`
        .toLowerCase()
        .includes(query);
    });

    return [...filtered].sort((left, right) => {
      if (sortBy === "az") {
        return left.code.localeCompare(right.code);
      }

      if (sortBy === "za") {
        return right.code.localeCompare(left.code);
      }

      if (sortBy === "created") {
        return right.createdAt.localeCompare(left.createdAt);
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });
  }, [deferredSearch, modules, sortBy]);

  const totalCount = visibleModules.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, pageCount);
  const paginatedModules = visibleModules.slice((safePage - 1) * pageSize, safePage * pageSize);

  const filteredDegrees = useMemo(
    () => degrees.filter((degree) => degree.facultyCode === form.facultyCode),
    [degrees, form.facultyCode]
  );

  const isEditMode = modal?.mode === "edit";
  const lockMappingFields =
    isEditMode && (isLoadingLockedAssignments || lockedAssignments > 0);

  const dependencyCount = dependencyData?.totalOfferings ?? 0;

  const filteredDependencyItems = useMemo(() => {
    if (!dependencyData) {
      return [];
    }

    const query = dependencySearch.trim().toLowerCase();
    if (!query) {
      return dependencyData.items;
    }

    return dependencyData.items.filter((item) =>
      `${item.facultyCode} ${item.facultyName} ${item.degreeCode} ${item.intakeName} ${item.termCode} ${item.syllabusVersion}`
        .toLowerCase()
        .includes(query)
    );
  }, [dependencyData, dependencySearch]);

  const openAddModal = () => {
    setModal({ mode: "add" });
    setForm(emptyFormState());
    setLockedAssignments(0);
    setIsLoadingLockedAssignments(false);
  };

  const openEditModal = (module: ModuleRecord) => {
    setModal({ mode: "edit", targetId: module.id });
    setForm({
      code: module.code,
      name: module.name,
      credits: String(module.credits || 0),
      facultyCode: module.facultyCode,
      applicableTerms: [...module.applicableTerms],
      applicableDegrees: [...module.applicableDegrees],
      defaultSyllabusVersion: module.defaultSyllabusVersion,
      outlineTemplate: module.outlineTemplate.map((item) => ({ ...item })),
    });
    setLockedAssignments(0);
    setIsLoadingLockedAssignments(true);

    void fetchDependencies(module.id)
      .then((dependencies) => {
        setLockedAssignments(dependencies.totalOfferings);
      })
      .catch((error) => {
        setLockedAssignments(0);
        toast({
          title: "Failed",
          message:
            error instanceof Error
              ? error.message
              : "Failed to check module assignments",
          variant: "error",
        });
      })
      .finally(() => {
        setIsLoadingLockedAssignments(false);
      });
  };

  const saveModule = async () => {
    if (!modal) {
      return;
    }

    const normalizedCode = normalizeModuleCode(form.code);
    const name = form.name.trim();
    const credits = Number(form.credits);
    const facultyCode = normalizeAcademicCode(form.facultyCode);
    const applicableTerms = TERM_SEQUENCE.filter((term) =>
      form.applicableTerms.includes(term)
    );
    const applicableDegrees = Array.from(
      new Set(form.applicableDegrees.map((degree) => normalizeAcademicCode(degree)).filter(Boolean))
    );

    if (modal.mode === "add") {
      if (!/^[A-Z0-9]{2,10}$/.test(normalizedCode)) {
        toast({
          title: "Failed",
          message: "Use 2-10 uppercase letters or numbers for module code",
          variant: "error",
        });
        return;
      }

      if (modules.some((module) => module.code === normalizedCode)) {
        toast({
          title: "Failed",
          message: "Module code already exists",
          variant: "error",
        });
        return;
      }
    }

    if (!name) {
      toast({
        title: "Failed",
        message: "Module name is required",
        variant: "error",
      });
      return;
    }

    if (!Number.isFinite(credits) || credits <= 0) {
      toast({
        title: "Failed",
        message: "Credits must be greater than 0",
        variant: "error",
      });
      return;
    }

    if (!facultyCode) {
      toast({
        title: "Failed",
        message: "Select a faculty",
        variant: "error",
      });
      return;
    }

    if (applicableTerms.length === 0) {
      toast({
        title: "Failed",
        message: "Select at least one applicable term",
        variant: "error",
      });
      return;
    }

    if (applicableDegrees.length === 0) {
      toast({
        title: "Failed",
        message: "Select at least one applicable degree",
        variant: "error",
      });
      return;
    }

    const invalidDegree = applicableDegrees.find(
      (degreeCode) =>
        !degrees.some(
          (degree) =>
            degree.code === degreeCode && degree.facultyCode === facultyCode
        )
    );
    if (invalidDegree) {
      toast({
        title: "Failed",
        message: `Degree ${invalidDegree} does not belong to selected faculty`,
        variant: "error",
      });
      return;
    }

    const payload = {
      code: normalizedCode,
      name,
      credits,
      facultyCode,
      applicableTerms,
      applicableDegrees,
      defaultSyllabusVersion: form.defaultSyllabusVersion,
      outlineTemplate: form.outlineTemplate
        .map((item) => ({
          weekNo: Math.max(1, Math.min(60, Math.floor(Number(item.weekNo) || 1))),
          title: String(item.title ?? "").trim(),
          type: normalizeOutlineType(item.type),
        }))
        .filter((item) => Boolean(item.title)),
    };

    const endpoint =
      modal.mode === "edit"
        ? `/api/modules/${encodeURIComponent(String(modal.targetId ?? ""))}`
        : "/api/modules";
    const method = modal.mode === "edit" ? "PUT" : "POST";

    setIsSaving(true);

    try {
      await readJson<unknown>(
        await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );

      toast({
        title: "Saved",
        message: `Module ${modal.mode === "edit" ? "updated" : "created"} successfully`,
        variant: "success",
      });
      closeEditModal();
      await loadData({ background: true });
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

  const openDeleteFlow = async (module: ModuleRecord) => {
    setCheckingDeleteModuleId(module.id);

    try {
      const dependencies = await fetchDependencies(module.id);
      if (dependencies.totalOfferings === 0) {
        setDeleteConfirmTarget(module);
        return;
      }

      setDependencyModalTarget(module);
      setDependencyData(dependencies);
      setDependencySearch("");
    } catch (error) {
      toast({
        title: "Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to check module dependencies",
        variant: "error",
      });
    } finally {
      setCheckingDeleteModuleId(null);
    }
  };

  const executeDeleteModule = async (
    moduleId: string,
    options?: { closeDependencyFlow?: boolean }
  ) => {
    setIsDeletingModule(true);

    try {
      await readJson<unknown>(
        await fetch(`/api/modules/${encodeURIComponent(moduleId)}`, {
          method: "DELETE",
        })
      );

      setModules((previous) => previous.filter((module) => module.id !== moduleId));
      setDeleteConfirmTarget(null);
      setShowDependencyDeleteConfirm(false);

      if (options?.closeDependencyFlow) {
        closeDependencyModal();
      }

      if (modal?.mode === "edit" && modal.targetId === moduleId) {
        closeEditModal();
      }

      toast({
        title: "Deleted",
        message: "Module deleted successfully",
        variant: "success",
      });

      void loadData({ background: true, silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete module";

      if (message === "Module is assigned") {
        const target =
          modules.find((module) => module.id === moduleId) ??
          dependencyModalTarget ??
          deleteConfirmTarget;

        if (target) {
          try {
            const dependencies = await fetchDependencies(moduleId);
            setDeleteConfirmTarget(null);
            setDependencyModalTarget(target);
            setDependencyData(dependencies);
            setDependencySearch("");
            setShowDependencyDeleteConfirm(false);
          } catch {
            // Keep existing UI state if dependency refresh fails.
          }
        }
      }

      toast({
        title: "Failed",
        message,
        variant: "error",
      });
    } finally {
      setIsDeletingModule(false);
    }
  };

  const unassignOne = async (offeringId: string) => {
    if (!dependencyModalTarget) {
      return;
    }

    setIsUnassigningOfferingId(offeringId);

    try {
      await readJson<unknown>(
        await fetch(`/api/module-offerings/${encodeURIComponent(offeringId)}`, {
          method: "DELETE",
        })
      );

      toast({
        title: "Unassigned",
        message: "Module offering unassigned",
        variant: "success",
      });
      await refreshDependencyData();
    } catch (error) {
      toast({
        title: "Failed",
        message: error instanceof Error ? error.message : "Failed to unassign offering",
        variant: "error",
      });
      await refreshDependencyData().catch(() => null);
    } finally {
      setIsUnassigningOfferingId(null);
    }
  };

  const unassignAll = async () => {
    if (!dependencyModalTarget) {
      return;
    }

    setIsUnassigningAll(true);

    try {
      const response = await fetch(
        `/api/modules/${encodeURIComponent(dependencyModalTarget.id)}/unassign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unassignAll: true }),
        }
      );
      const payload = (await response.json().catch(() => null)) as unknown;
      const root = asObject(payload);
      const removedCount = Math.max(0, Number(root?.removedCount) || 0);
      const blockedItems = Array.isArray(root?.blocked) ? root.blocked : [];
      const blockedCount = blockedItems.length;

      if (removedCount > 0) {
        toast({
          title: "Unassigned",
          message:
            removedCount === 1
              ? "1 offering unassigned"
              : `${removedCount} offerings unassigned`,
          variant: "success",
        });
      }

      if (blockedCount > 0) {
        toast({
          title: "Failed",
          message:
            blockedCount === 1
              ? "1 offering could not be unassigned because it has grades, attendance, or content."
              : `${blockedCount} offerings could not be unassigned because they have grades, attendance, or content.`,
          variant: "error",
        });
      }

      if (!response.ok && removedCount === 0 && blockedCount === 0) {
        throw new Error(
          root && typeof root.message === "string"
            ? root.message
            : "Failed to unassign offerings"
        );
      }

      await refreshDependencyData();
    } catch (error) {
      toast({
        title: "Failed",
        message:
          error instanceof Error ? error.message : "Failed to unassign all offerings",
        variant: "error",
      });
      await refreshDependencyData().catch(() => null);
    } finally {
      setIsUnassigningAll(false);
      setShowUnassignAllConfirm(false);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        actions={
          <Button
            className="h-11 min-w-[164px] justify-center gap-2 rounded-2xl bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] transition-colors hover:bg-[#0339a6]"
            onClick={openAddModal}
          >
            <Plus size={16} />
            Add Module
          </Button>
        }
        description="Master modules with protected assignment-aware delete and edit flows."
        title="Modules"
      />

      <Card
        className={cn(
          "transition-all",
          isOverlayOpen ? "pointer-events-none opacity-45 blur-[1px]" : ""
        )}
      >
        <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_220px]">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                Search
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/50"
                  size={16}
                />
                <Input
                  aria-label="Search modules"
                  className="h-12 pl-10"
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by code, name, or faculty"
                  value={searchQuery}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                Sort
              </label>
              <Select
                aria-label="Sort modules"
                className="h-12"
                onChange={(event) => {
                  setSortBy(event.target.value as SortOption);
                  setPage(1);
                }}
                value={sortBy}
              >
                <option value="updated">Recently Updated</option>
                <option value="created">Recently Added</option>
                <option value="az">A-Z</option>
                <option value="za">Z-A</option>
              </Select>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-tint px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
              Total Modules
            </p>
            <p className="mt-1 text-2xl font-semibold text-heading">{totalCount}</p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-border bg-tint">
              <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Faculty</th>
                <th className="px-4 py-3">Degrees</th>
                <th className="px-4 py-3">Terms</th>
                <th className="px-4 py-3">Syllabus</th>
                <th className="px-4 py-3">Last Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-text/68" colSpan={7}>
                    Loading module records...
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? paginatedModules.map((module) => (
                    <tr
                      className="border-b border-border/70 transition-colors hover:bg-tint"
                      key={module.id}
                    >
                      <td className="px-4 py-4">
                        <p className="font-semibold text-heading">{module.code}</p>
                        <p className="mt-0.5 text-sm text-text/78">{module.name}</p>
                        <p className="mt-0.5 text-xs text-text/60">{module.credits} credits</p>
                      </td>
                      <td className="px-4 py-4 text-text/75">{module.facultyCode || "—"}</td>
                      <td className="px-4 py-4 text-text/75">
                        {module.applicableDegrees.length > 0
                          ? module.applicableDegrees.join(", ")
                          : "—"}
                      </td>
                      <td className="px-4 py-4 text-text/75">
                        {module.applicableTerms.length > 0
                          ? module.applicableTerms.join(", ")
                          : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={statusVariant(module.defaultSyllabusVersion)}>
                          {module.defaultSyllabusVersion}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-text/70">{formatDate(module.updatedAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            aria-label={`Edit ${module.code}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/70 hover:bg-tint hover:text-heading"
                            onClick={() => openEditModal(module)}
                            type="button"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            aria-label={`Delete ${module.code}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-text/70 hover:bg-tint hover:text-heading disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={checkingDeleteModuleId === module.id}
                            onClick={() => {
                              void openDeleteFlow(module);
                            }}
                            type="button"
                          >
                            {checkingDeleteModuleId === module.id ? (
                              <Loader2 className="animate-spin" size={16} />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}

              {!isLoading && paginatedModules.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-text/68" colSpan={7}>
                    No modules match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
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
          totalItems={totalCount}
        />
      </Card>

      {modal ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) {
              closeEditModal();
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_56px_rgba(15,23,42,0.22)]"
            role="dialog"
          >
            <div className="overflow-y-auto px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                    {modal.mode === "add" ? "CREATE" : "EDIT"}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-heading">
                    {modal.mode === "add" ? "Add Module" : "Edit Module"}
                  </p>
                  <p className="mt-1 text-sm text-text/65">
                    Scope: Super Admin / Academic Structure / Modules
                  </p>
                </div>
                <button
                  aria-label="Close modal"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-text/70 hover:bg-tint hover:text-heading disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving}
                  onClick={closeEditModal}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>

              {modal.mode === "edit" && lockedAssignments > 0 ? (
                <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                    <p>
                      This module is currently assigned to {lockedAssignments} intake
                      {lockedAssignments === 1 ? "" : "s"}. Some fields are locked.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="moduleCode">
                    Module Code
                  </label>
                  <Input
                    className="h-12"
                    disabled={isSaving || modal.mode === "edit"}
                    id="moduleCode"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        code: normalizeModuleCode(event.target.value),
                      }))
                    }
                    placeholder="SE101"
                    value={form.code}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="moduleCredits">
                    Credits
                  </label>
                  <Input
                    className="h-12"
                    disabled={isSaving}
                    id="moduleCredits"
                    min={1}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        credits: event.target.value,
                      }))
                    }
                    placeholder="4"
                    type="number"
                    value={form.credits}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="moduleName">
                    Module Name
                  </label>
                  <Input
                    className="h-12"
                    disabled={isSaving}
                    id="moduleName"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Programming Fundamentals"
                    value={form.name}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="moduleFaculty">
                    Faculty
                  </label>
                  <Select
                    aria-label="Module faculty"
                    className="h-12"
                    disabled={isSaving || lockMappingFields}
                    id="moduleFaculty"
                    onChange={(event) =>
                      setForm((previous) => {
                        const nextFacultyCode = normalizeAcademicCode(event.target.value);
                        const allowedDegreeCodes = new Set(
                          degrees
                            .filter((degree) => degree.facultyCode === nextFacultyCode)
                            .map((degree) => degree.code)
                        );

                        return {
                          ...previous,
                          facultyCode: nextFacultyCode,
                          applicableDegrees: previous.applicableDegrees.filter((degree) =>
                            allowedDegreeCodes.has(degree)
                          ),
                        };
                      })
                    }
                    value={form.facultyCode}
                  >
                    <option value="">Select faculty</option>
                    {faculties.map((faculty) => (
                      <option key={faculty.code} value={faculty.code}>
                        {faculty.code} - {faculty.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading" htmlFor="moduleSyllabus">
                    Default Syllabus
                  </label>
                  <Select
                    aria-label="Default syllabus version"
                    className="h-12"
                    disabled={isSaving}
                    id="moduleSyllabus"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        defaultSyllabusVersion:
                          event.target.value === "OLD" ? "OLD" : "NEW",
                      }))
                    }
                    value={form.defaultSyllabusVersion}
                  >
                    <option value="NEW">NEW</option>
                    <option value="OLD">OLD</option>
                  </Select>
                </div>

                <div className="sm:col-span-2">
                  <div className="rounded-2xl border border-border bg-tint/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                      Applicable Terms
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {TERM_SEQUENCE.map((term) => (
                        <label
                          className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-2.5 py-1.5 text-sm text-heading"
                          key={term}
                        >
                          <input
                            checked={form.applicableTerms.includes(term)}
                            className="h-4 w-4 rounded border-border"
                            disabled={isSaving || lockMappingFields}
                            onChange={() =>
                              setForm((previous) => ({
                                ...previous,
                                applicableTerms: previous.applicableTerms.includes(term)
                                  ? previous.applicableTerms.filter((item) => item !== term)
                                  : [...previous.applicableTerms, term],
                              }))
                            }
                            type="checkbox"
                          />
                          {term}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <div className="rounded-2xl border border-border bg-tint/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                      Applicable Degrees
                    </p>
                    <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
                      {filteredDegrees.length === 0 ? (
                        <p className="text-sm text-text/65">Select faculty to load degrees</p>
                      ) : (
                        filteredDegrees.map((degree) => (
                          <label
                            className="inline-flex w-full items-center gap-2 rounded-xl border border-border bg-white px-2.5 py-1.5 text-sm text-heading"
                            key={degree.code}
                          >
                            <input
                              checked={form.applicableDegrees.includes(degree.code)}
                              className="h-4 w-4 rounded border-border"
                              disabled={isSaving || lockMappingFields}
                              onChange={() =>
                                setForm((previous) => ({
                                  ...previous,
                                  applicableDegrees: previous.applicableDegrees.includes(degree.code)
                                    ? previous.applicableDegrees.filter(
                                        (item) => item !== degree.code
                                      )
                                    : [...previous.applicableDegrees, degree.code],
                                }))
                              }
                              type="checkbox"
                            />
                            {degree.code} - {degree.name}
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-white px-6 py-4 shadow-[0_-1px_0_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <Button
                  className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
                  disabled={isSaving}
                  onClick={closeEditModal}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  className="h-11 min-w-[132px] gap-2 bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
                  disabled={isSaving}
                  onClick={() => {
                    void saveModule();
                  }}
                >
                  <Save size={16} />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmTarget ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isDeletingModule) {
              setDeleteConfirmTarget(null);
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-white shadow-[0_18px_36px_rgba(15,23,42,0.2)]"
            role="dialog"
          >
            <div className="px-6 py-6">
              <p className="text-lg font-semibold text-heading">Delete Module</p>
              <p className="mt-2 text-sm leading-6 text-text/70">
                Delete module permanently? This cannot be undone.
              </p>
              <p className="mt-2 text-sm font-semibold text-heading">
                {deleteConfirmTarget.code} - {deleteConfirmTarget.name}
              </p>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-border bg-white px-6 py-4">
              <Button
                className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
                disabled={isDeletingModule}
                onClick={() => setDeleteConfirmTarget(null)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                className="h-11 min-w-[132px] gap-2 bg-red-600 px-5 text-white shadow-[0_10px_24px_rgba(220,38,38,0.22)] hover:bg-red-700"
                disabled={isDeletingModule}
                onClick={() => {
                  if (!deleteConfirmTarget) {
                    return;
                  }

                  void executeDeleteModule(deleteConfirmTarget.id);
                }}
              >
                {isDeletingModule ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {dependencyModalTarget && dependencyData ? (
        <div
          className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isDeletingModule && !isUnassigningAll) {
              closeDependencyModal();
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
            role="dialog"
          >
            <div className="border-b border-border px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
                    Cannot Delete Module
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-heading">Module is assigned</p>
                  <p className="mt-1 text-sm text-text/65">
                    Remove assignments before deleting this module.
                  </p>
                  <p className="mt-2 text-sm font-semibold text-heading">
                    {dependencyModalTarget.code} - {dependencyModalTarget.name}
                  </p>
                </div>
                <button
                  aria-label="Close dependency modal"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-text/70 hover:bg-tint hover:text-heading disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isDeletingModule || isUnassigningAll}
                  onClick={closeDependencyModal}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-md">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text/55"
                    size={16}
                  />
                  <Input
                    className="h-11 pl-9"
                    onChange={(event) => setDependencySearch(event.target.value)}
                    placeholder="Search dependencies"
                    value={dependencySearch}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm text-text/70">
                    Remaining assignments:{" "}
                    <span className="font-semibold text-heading">{dependencyCount}</span>
                  </span>
                  <Button
                    className="h-11 gap-2 border-red-200 bg-red-50 px-4 text-red-700 hover:bg-red-100"
                    disabled={dependencyCount === 0 || isUnassigningAll || isDeletingModule}
                    onClick={() => setShowUnassignAllConfirm(true)}
                    variant="secondary"
                  >
                    <Unlink2 size={16} />
                    Unassign All
                  </Button>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="border-b border-border bg-tint">
                    <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-text/60">
                      <th className="px-4 py-3">Faculty</th>
                      <th className="px-4 py-3">Degree</th>
                      <th className="px-4 py-3">Intake</th>
                      <th className="px-4 py-3">Term</th>
                      <th className="px-4 py-3">Syllabus</th>
                      <th className="px-4 py-3">Assigned Lecturers Count</th>
                      <th className="px-4 py-3">Updated</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDependencyItems.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-text/70" colSpan={8}>
                          {dependencyCount === 0
                            ? "No active assignments. You can delete this module."
                            : "No dependencies match the current search."}
                        </td>
                      </tr>
                    ) : (
                      filteredDependencyItems.map((item) => (
                        <tr
                          className="border-b border-border/70 transition-colors hover:bg-tint/60"
                          key={item.offeringId}
                        >
                          <td className="px-4 py-3 text-text/78">
                            {item.facultyCode || "—"}
                            {item.facultyName ? (
                              <p className="text-xs text-text/58">{item.facultyName}</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-text/78">
                            {item.degreeCode || item.degreeId || "—"}
                          </td>
                          <td className="px-4 py-3 text-text/78">{item.intakeName || "—"}</td>
                          <td className="px-4 py-3 text-text/78">{item.termCode || "—"}</td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                normalizeSyllabusVersion(item.syllabusVersion) === "OLD"
                                  ? "warning"
                                  : "primary"
                              }
                            >
                              {normalizeSyllabusVersion(item.syllabusVersion)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-text/78">{item.lecturerCount}</td>
                          <td className="px-4 py-3 text-text/70">{formatDate(item.updatedAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end">
                              <Button
                                className="h-9 gap-2 border-red-200 bg-red-50 px-3 text-red-700 hover:bg-red-100"
                                disabled={
                                  isDeletingModule ||
                                  isUnassigningAll ||
                                  isUnassigningOfferingId === item.offeringId
                                }
                                onClick={() => {
                                  void unassignOne(item.offeringId);
                                }}
                                variant="secondary"
                              >
                                {isUnassigningOfferingId === item.offeringId ? (
                                  <Loader2 className="animate-spin" size={14} />
                                ) : (
                                  <Trash2 size={14} />
                                )}
                                Unassign
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t border-border bg-white px-6 py-4">
              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <Button
                  className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
                  disabled={isDeletingModule || isUnassigningAll}
                  onClick={closeDependencyModal}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  className="h-11 min-w-[152px] gap-2 bg-red-600 px-5 text-white shadow-[0_10px_24px_rgba(220,38,38,0.22)] hover:bg-red-700 disabled:bg-red-300"
                  disabled={dependencyCount > 0 || isDeletingModule || isUnassigningAll}
                  onClick={() => setShowDependencyDeleteConfirm(true)}
                >
                  <Trash2 size={16} />
                  Delete Module
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showUnassignAllConfirm ? (
        <div
          className="fixed inset-0 z-[99] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isUnassigningAll) {
              setShowUnassignAllConfirm(false);
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-white shadow-[0_18px_36px_rgba(15,23,42,0.2)]"
            role="dialog"
          >
            <div className="px-6 py-6">
              <p className="text-lg font-semibold text-heading">Unassign All</p>
              <p className="mt-2 text-sm leading-6 text-text/70">
                Unassign all visible module offerings for this module?
              </p>
            </div>
            <div className="flex justify-end gap-2.5 border-t border-border bg-white px-6 py-4">
              <Button
                className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
                disabled={isUnassigningAll}
                onClick={() => setShowUnassignAllConfirm(false)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                className="h-11 min-w-[132px] gap-2 bg-red-600 px-5 text-white shadow-[0_10px_24px_rgba(220,38,38,0.22)] hover:bg-red-700"
                disabled={isUnassigningAll}
                onClick={() => {
                  void unassignAll();
                }}
              >
                {isUnassigningAll ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Unassigning...
                  </>
                ) : (
                  <>
                    <Unlink2 size={16} />
                    Unassign All
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showDependencyDeleteConfirm && dependencyModalTarget ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isDeletingModule) {
              setShowDependencyDeleteConfirm(false);
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-white shadow-[0_18px_36px_rgba(15,23,42,0.2)]"
            role="dialog"
          >
            <div className="px-6 py-6">
              <p className="text-lg font-semibold text-heading">Delete Module</p>
              <p className="mt-2 text-sm leading-6 text-text/70">
                Delete module permanently? This cannot be undone.
              </p>
              <p className="mt-2 text-sm font-semibold text-heading">
                {dependencyModalTarget.code} - {dependencyModalTarget.name}
              </p>
            </div>
            <div className="flex justify-end gap-2.5 border-t border-border bg-white px-6 py-4">
              <Button
                className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
                disabled={isDeletingModule}
                onClick={() => setShowDependencyDeleteConfirm(false)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                className="h-11 min-w-[132px] gap-2 bg-red-600 px-5 text-white shadow-[0_10px_24px_rgba(220,38,38,0.22)] hover:bg-red-700"
                disabled={isDeletingModule}
                onClick={() => {
                  void executeDeleteModule(dependencyModalTarget.id, {
                    closeDependencyFlow: true,
                  });
                }}
              >
                {isDeletingModule ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

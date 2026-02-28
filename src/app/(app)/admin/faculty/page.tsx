"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Building2,
  CalendarDays,
  ChevronsUp,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Layers3,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

type NodeType =
  | "FACULTY"
  | "PROGRAM"
  | "BADGE"
  | "YEAR"
  | "SEMESTER"
  | "MODULE";

interface StructureNode {
  id: string;
  type: NodeType;
  name: string;
  code?: string;
  credits?: number;
  children: StructureNode[];
}

interface SelectedNode {
  path: string[];
}

interface ModalState {
  mode: "add" | "edit";
  targetType: NodeType;
  targetPath?: string[];
}

interface FormValues {
  name: string;
  code: string;
  credits: string;
}

interface AdminModalProps {
  open: boolean;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}

const TYPE_LABEL: Record<NodeType, string> = {
  FACULTY: "Faculty",
  PROGRAM: "Degree Program",
  BADGE: "Badge",
  YEAR: "Year",
  SEMESTER: "Semester",
  MODULE: "Module",
};

const TYPE_ICON: Record<NodeType, React.ComponentType<{ size?: number }>> = {
  FACULTY: Building2,
  PROGRAM: GraduationCap,
  BADGE: Tag,
  YEAR: Layers3,
  SEMESTER: CalendarDays,
  MODULE: BookOpen,
};

const CHILD_TYPE_BY_PARENT: Record<NodeType, NodeType | null> = {
  FACULTY: "PROGRAM",
  PROGRAM: "BADGE",
  BADGE: "YEAR",
  YEAR: "SEMESTER",
  SEMESTER: "MODULE",
  MODULE: null,
};

const SEMESTER_OPTIONS = ["Semester 1", "Semester 2"];

function seedData(): StructureNode[] {
  const moduleTemplates = {
    s1: ["Foundations", "Communication Skills", "Discrete Mathematics"],
    s2: ["Applied Practice", "Systems Thinking", "Project Studio"],
  };

  function modules(programCode: string, batch: string, year: number, sem: number) {
    const names = sem === 1 ? moduleTemplates.s1 : moduleTemplates.s2;
    return names.map((name, index) => ({
      id: `mod-${programCode}-${batch}-${year}-${sem}-${index + 1}`,
      type: "MODULE" as const,
      name: `${name} ${year}`,
      code: `${programCode}-${batch.slice(-2)}${year}${sem}${index + 1}0`,
      credits: index === 2 ? 4 : 3,
      children: [],
    }));
  }

  function program(id: string, name: string, code: string): StructureNode {
    return {
      id,
      type: "PROGRAM",
      name,
      code,
      children: ["2025", "2026"].map((batch) => ({
        id: `badge-${id}-${batch}`,
        type: "BADGE",
        name: batch,
        children: ["1st Year", "2nd Year"].map((yearLabel, yearIndex) => ({
          id: `year-${id}-${batch}-${yearIndex + 1}`,
          type: "YEAR",
          name: yearLabel,
          children: SEMESTER_OPTIONS.map((semesterLabel, semIndex) => ({
            id: `sem-${id}-${batch}-${yearIndex + 1}-${semIndex + 1}`,
            type: "SEMESTER",
            name: semesterLabel,
            children: modules(code, batch, yearIndex + 1, semIndex + 1),
          })),
        })),
      })),
    };
  }

  return [
    {
      id: "fac-computing",
      type: "FACULTY",
      name: "Faculty of Computing",
      code: "FOC",
      children: [
        program("prog-cs", "BSc Computer Science", "CS"),
        program("prog-se", "BSc Software Engineering", "SE"),
      ],
    },
    {
      id: "fac-engineering",
      type: "FACULTY",
      name: "Faculty of Engineering",
      code: "FOE",
      children: [
        program("prog-me", "BEng Mechanical Engineering", "ME"),
        program("prog-ee", "BEng Electrical Engineering", "EE"),
      ],
    },
  ];
}

function getNodeByPath(nodes: StructureNode[], path: string[]): StructureNode | null {
  let current: StructureNode | null = null;
  let level = nodes;
  for (const id of path) {
    current = level.find((item) => item.id === id) ?? null;
    if (!current) return null;
    level = current.children;
  }
  return current;
}

function getTrail(nodes: StructureNode[], path: string[]): StructureNode[] {
  const trail: StructureNode[] = [];
  let level = nodes;
  for (const id of path) {
    const node = level.find((item) => item.id === id);
    if (!node) return trail;
    trail.push(node);
    level = node.children;
  }
  return trail;
}

function patchNode(
  nodes: StructureNode[],
  path: string[],
  updater: (node: StructureNode) => StructureNode
): StructureNode[] {
  if (path.length === 0) return nodes;
  return nodes.map((node) => {
    if (node.id !== path[0]) return node;
    if (path.length === 1) return updater(node);
    return { ...node, children: patchNode(node.children, path.slice(1), updater) };
  });
}

function removeNode(nodes: StructureNode[], path: string[]): StructureNode[] {
  if (path.length === 0) return nodes;
  return nodes
    .filter((node) => node.id !== path[0] || path.length > 1)
    .map((node) =>
      node.id === path[0]
        ? { ...node, children: removeNode(node.children, path.slice(1)) }
        : node
    );
}

function findFirstPath(nodes: StructureNode[]): string[] | null {
  const first = nodes[0];
  if (!first) return null;
  return [first.id];
}

function AdminModal({
  open,
  title,
  description,
  icon,
  onClose,
  children,
  footer,
}: AdminModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFirstElement = () => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>(
        "input, select, textarea, button, [href], [tabindex]:not([tabindex='-1'])"
      );
      focusable?.focus();
    };

    focusFirstElement();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      if (!focusableElements || focusableElements.length === 0) {
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!active || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  return (
    <div
      className={[
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        "bg-black/40 backdrop-blur-sm transition-opacity duration-200 ease-out",
        open ? "opacity-100" : "pointer-events-none opacity-0",
      ].join(" ")}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        aria-labelledby="admin-modal-title"
        aria-modal="true"
        className={[
          "w-full max-w-[92vw] sm:max-w-xl rounded-2xl border border-[#26150F]/15 bg-white p-6 shadow-2xl sm:p-8",
          "transition-all duration-200 ease-out",
          open ? "scale-100 opacity-100" : "scale-95 opacity-0",
        ].join(" ")}
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {icon ? (
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#034AA6]/25 bg-[#034AA6]/10 text-[#034AA6]">
                {icon}
              </span>
            ) : null}
            <div>
              <h3 className="text-xl font-semibold text-[#0A0A0A]" id="admin-modal-title">
                {title}
              </h3>
              {description ? (
                <p className="mt-1 text-sm text-[#26150F]/72">{description}</p>
              ) : null}
            </div>
          </div>
          <button
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#26150F]/20 text-[#26150F]/75 transition-colors duration-200 hover:border-[#034AA6]/45 hover:bg-[#034AA6]/8 hover:text-[#0339A6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#034AA6]/30"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-6">{children}</div>
        <div className="mt-6">{footer}</div>
      </div>
    </div>
  );
}

export default function AdminFacultyPage() {
  const [tree, setTree] = useState<StructureNode[]>(() => seedData());
  const [selected, setSelected] = useState<SelectedNode | null>(() => {
    const firstPath = findFirstPath(seedData());
    return firstPath ? { path: firstPath } : null;
  });
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const first = findFirstPath(seedData());
    return new Set(first ?? []);
  });
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [closingModal, setClosingModal] = useState<ModalState | null>(null);
  const [values, setValues] = useState<FormValues>({ name: "", code: "", credits: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const idCounter = useRef(1);
  const closeTimerRef = useRef<number | null>(null);

  const modalView = modal ?? closingModal;
  const modalOpen = Boolean(modal);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const selectedNode = useMemo(
    () => (selected ? getNodeByPath(tree, selected.path) : null),
    [selected, tree]
  );
  const trail = useMemo(() => (selected ? getTrail(tree, selected.path) : []), [selected, tree]);
  const visibleTree = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tree;

    const filter = (nodes: StructureNode[]): StructureNode[] =>
      nodes.reduce<StructureNode[]>((acc, node) => {
        const children = filter(node.children);
        const matches =
          node.name.toLowerCase().includes(query) ||
          (node.code ?? "").toLowerCase().includes(query);
        if (matches || children.length > 0) {
          acc.push({ ...node, children });
        }
        return acc;
      }, []);

    return filter(tree);
  }, [search, tree]);

  const childType = selectedNode ? CHILD_TYPE_BY_PARENT[selectedNode.type] : null;
  const childRows = selectedNode?.children ?? [];

  const nextId = (type: NodeType) => {
    const id = `${type.toLowerCase()}-${Date.now()}-${idCounter.current}`;
    idCounter.current += 1;
    return id;
  };

  const openAdd = (targetType: NodeType, parentPath?: string[]) => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setClosingModal(null);
    setModal({ mode: "add", targetType, targetPath: parentPath });
    setValues({
      name: targetType === "SEMESTER" ? "Semester 1" : "",
      code: "",
      credits: "",
    });
    setErrors({});
  };

  const openEdit = (path: string[]) => {
    const node = getNodeByPath(tree, path);
    if (!node) return;
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setClosingModal(null);
    setModal({ mode: "edit", targetType: node.type, targetPath: path });
    setValues({
      name: node.name,
      code: node.code ?? "",
      credits: node.credits ? `${node.credits}` : "",
    });
    setErrors({});
  };

  const closeModal = () => {
    if (!modal && !closingModal) {
      return;
    }

    if (modal) {
      setClosingModal(modal);
      setModal(null);
    }

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      setClosingModal(null);
      setValues({ name: "", code: "", credits: "" });
      setErrors({});
      closeTimerRef.current = null;
    }, 200);
  };

  const validate = (targetType: NodeType) => {
    const next: Partial<Record<keyof FormValues, string>> = {};
    if (!values.name.trim()) next.name = "Required";
    if ((targetType === "FACULTY" || targetType === "PROGRAM" || targetType === "MODULE") && !values.code.trim()) {
      next.code = "Required";
    }
    if (targetType === "MODULE") {
      if (!values.credits.trim()) {
        next.credits = "Required";
      } else if (Number.isNaN(Number(values.credits)) || Number(values.credits) <= 0) {
        next.credits = "Enter a valid number";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleDelete = (path: string[]) => {
    const node = getNodeByPath(tree, path);
    if (!node) return;
    if (!window.confirm(`Delete this ${TYPE_LABEL[node.type].toLowerCase()}?`)) return;

    const nextTree = removeNode(tree, path);
    setTree(nextTree);
    const parentPath = path.slice(0, -1);
    if (parentPath.length > 0 && getNodeByPath(nextTree, parentPath)) {
      setSelected({ path: parentPath });
    } else {
      const first = findFirstPath(nextTree);
      setSelected(first ? { path: first } : null);
    }
  };

  const handleCollapseAll = () => {
    setExpanded(new Set());
  };

  const handleRefresh = () => {
    const nextTree = seedData();
    const firstPath = findFirstPath(nextTree);
    setTree(nextTree);
    setSelected(firstPath ? { path: firstPath } : null);
    setExpanded(new Set(firstPath ?? []));
    setSearch("");
  };

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modal) return;
    if (!validate(modal.targetType)) return;

    if (modal.mode === "add") {
      const newNode: StructureNode = {
        id: nextId(modal.targetType),
        type: modal.targetType,
        name: values.name.trim(),
        code: values.code.trim() || undefined,
        credits: modal.targetType === "MODULE" ? Number(values.credits) : undefined,
        children: [],
      };

      if (modal.targetType === "FACULTY") {
        const nextTree = [...tree, newNode];
        setTree(nextTree);
        setSelected({ path: [newNode.id] });
      } else if (modal.targetPath) {
        const parentPath = modal.targetPath;
        const nextTree = patchNode(tree, modal.targetPath, (parent) => ({
          ...parent,
          children: [...parent.children, newNode],
        }));
        setTree(nextTree);
        setExpanded((prev) => {
          const next = new Set(prev);
          for (const id of parentPath) next.add(id);
          return next;
        });
        setSelected({ path: [...parentPath, newNode.id] });
      }
    }

    if (modal.mode === "edit" && modal.targetPath) {
      const nextTree = patchNode(tree, modal.targetPath, (node) => ({
        ...node,
        name: values.name.trim(),
        code: values.code.trim() || undefined,
        credits: node.type === "MODULE" ? Number(values.credits) : undefined,
      }));
      setTree(nextTree);
    }

    closeModal();
  };

  const renderTree = (nodes: StructureNode[], pathPrefix: string[] = [], depth = 0): React.ReactNode =>
    nodes.map((node) => {
      const path = [...pathPrefix, node.id];
      const hasChildren = node.children.length > 0;
      const childContent = hasChildren ? renderTree(node.children, path, depth + 1) : null;

      const expandedNow = search.trim() ? true : expanded.has(node.id);
      const isSelected =
        selected?.path.length === path.length &&
        selected.path.every((id, index) => id === path[index]);
      const childTypeForNode = CHILD_TYPE_BY_PARENT[node.type];
      const NodeIcon = TYPE_ICON[node.type];

      return (
        <div key={node.id}>
          <div
            className={[
              "group relative flex items-center gap-2 rounded-2xl border px-2 py-2 transition-all duration-200",
              isSelected
                ? "border-[#034AA6]/35 bg-[#034AA6]/10"
                : "border-transparent hover:border-[#034AA6]/30 hover:bg-[#034AA6]/6",
            ].join(" ")}
            style={{ marginLeft: `${depth * 10}px` }}
          >
            {isSelected ? <span className="absolute inset-y-1 left-0 w-1 rounded-full bg-[#034AA6]" /> : null}
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#26150F]/75 transition-colors hover:bg-[#034AA6]/10 hover:text-[#0339A6]"
              onClick={() =>
                hasChildren &&
                setExpanded((prev) => {
                  const next = new Set(prev);
                  next.has(node.id) ? next.delete(node.id) : next.add(node.id);
                  return next;
                })
              }
              type="button"
            >
              {hasChildren ? (expandedNow ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <span className="h-1.5 w-1.5 rounded-full bg-[#26150F]/45" />}
            </button>
            <button
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              onClick={() => {
                setSelected({ path });
                setExpanded((prev) => {
                  const next = new Set(prev);
                  for (const id of path) next.add(id);
                  return next;
                });
              }}
              type="button"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#034AA6]/10 text-[#034AA6]">
                <NodeIcon size={14} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[#0A0A0A]">{node.name}</span>
                {node.code ? <span className="block truncate text-xs text-[#26150F]/70">{node.code}</span> : null}
              </span>
            </button>
            <div className="mr-1 hidden items-center gap-1 opacity-0 transition-opacity group-hover:flex group-hover:opacity-100">
              {childTypeForNode ? (
                <button className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-[#26150F]/70 transition-all hover:border-[#034AA6]/35 hover:bg-[#034AA6]/8 hover:text-[#0339A6]" onClick={(e) => { e.stopPropagation(); openAdd(childTypeForNode, path); }} type="button">
                  <Plus size={14} />
                </button>
              ) : null}
              <button className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-[#26150F]/70 transition-all hover:border-[#034AA6]/35 hover:bg-[#034AA6]/8 hover:text-[#0339A6]" onClick={(e) => { e.stopPropagation(); openEdit(path); }} type="button">
                <Pencil size={14} />
              </button>
              <button className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-[#26150F]/70 transition-all hover:border-[#034AA6]/35 hover:bg-[#034AA6]/8 hover:text-[#0339A6]" onClick={(e) => { e.stopPropagation(); handleDelete(path); }} type="button">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          {hasChildren && expandedNow ? (
            <div className="mt-1 space-y-1 border-l border-black/10 pl-2 transition-all duration-200">{childContent}</div>
          ) : null}
        </div>
      );
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[#0A0A0A]">
          Academic Structure Manager
        </h1>
        <p className="mt-2 text-sm text-[#26150F]/80">
          Manage faculties, degree programs, badges, years, semesters, and modules.
        </p>
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,35%)_minmax(0,65%)]">
        <Card className="rounded-3xl border border-[#26150F]/30 bg-white p-6">
          <div className="flex items-center justify-between gap-3 border-b border-[#26150F]/12 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#26150F]/60">
                Navigator
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center gap-1 rounded-full bg-[#034AA6] px-3 py-1.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#0339A6]"
                onClick={() => openAdd("FACULTY")}
                type="button"
              >
                <Plus size={14} />
                Faculty
              </button>

              <button
                aria-label="Collapse all"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/20 bg-white text-[#26150F] transition-colors duration-200 hover:border-[#034AA6] hover:bg-[#034AA6]/5 hover:text-[#034AA6]"
                onClick={handleCollapseAll}
                title="Collapse all"
                type="button"
              >
                <ChevronsUp size={14} />
              </button>

              <button
                aria-label="Refresh navigator"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/20 text-[#26150F] transition-colors duration-200 hover:border-[#034AA6] hover:text-[#034AA6]"
                onClick={handleRefresh}
                type="button"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          <div className="mt-5 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#26150F]/55" size={16} />
            <Input className="pl-9" onChange={(e) => setSearch(e.target.value)} placeholder="Search faculty/program/module..." value={search} />
          </div>

          <div className="mt-5 max-h-[620px] space-y-1 overflow-auto pr-1">
            {renderTree(visibleTree)}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-3xl border border-[#26150F]/30 bg-white p-6">
            {selectedNode ? (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#26150F]/65">
                  {trail.map((node, index) => (
                    <div className="inline-flex items-center gap-2" key={node.id}>
                      <span>{node.name}</span>
                      {index < trail.length - 1 ? <ChevronRight size={14} /> : null}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold text-[#0A0A0A]">{selectedNode.name}</h2>
                    <div className="mt-2">
                      <Badge variant="primary">{TYPE_LABEL[selectedNode.type]}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button className="gap-2" disabled={!childType} onClick={() => selected && childType && openAdd(childType, selected.path)}>
                      <Plus size={15} />
                      Add Child
                    </Button>
                    <Button className="gap-2" onClick={() => selected && openEdit(selected.path)} variant="secondary">
                      <Pencil size={15} />
                      Edit
                    </Button>
                    <Button className="gap-2 border-[#26150F]/35 text-[#26150F] hover:border-[#0339A6] hover:text-[#0339A6]" onClick={() => selected && handleDelete(selected.path)} variant="secondary">
                      <Trash2 size={15} />
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-2xl border border-[#26150F]/18 bg-white px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-[#26150F]/60">Type</p>
                    <p className="mt-1 text-sm font-medium text-[#26150F]">{TYPE_LABEL[selectedNode.type]}</p>
                  </div>
                  {selectedNode.code ? (
                    <div className="rounded-2xl border border-[#26150F]/18 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-[#26150F]/60">Code</p>
                      <p className="mt-1 text-sm font-medium text-[#26150F]">{selectedNode.code}</p>
                    </div>
                  ) : null}
                  {selectedNode.type === "MODULE" ? (
                    <div className="rounded-2xl border border-[#26150F]/18 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-[#26150F]/60">Credits</p>
                      <p className="mt-1 text-sm font-medium text-[#26150F]">{selectedNode.credits ?? "-"}</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[#26150F]/18 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-[#26150F]/60">
                        {childType ? `${TYPE_LABEL[childType]} Count` : "Items"}
                      </p>
                      <p className="mt-1 text-sm font-medium text-[#26150F]">{selectedNode.children.length}</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-[#26150F]/75">Select a node from the tree to view details.</p>
            )}
          </Card>

          <Card className="rounded-3xl border border-[#26150F]/30 bg-white p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-[#0A0A0A]">
                {selectedNode?.type === "MODULE" ? "Module Details" : childType ? `${TYPE_LABEL[childType]} List` : "Details"}
              </h3>
              {selected && childType ? (
                <Button className="gap-2" onClick={() => openAdd(childType, selected.path)} variant="secondary">
                  <Plus size={14} />
                  Add {TYPE_LABEL[childType]}
                </Button>
              ) : null}
            </div>

            <div className="mt-4">
              {selectedNode?.type === "MODULE" ? (
                <div className="space-y-3 rounded-2xl border border-[#26150F]/18 bg-[#034AA6]/6 p-4 text-sm text-[#26150F]">
                  <p><span className="font-semibold text-[#0A0A0A]">Module Code:</span> {selectedNode.code}</p>
                  <p><span className="font-semibold text-[#0A0A0A]">Module Name:</span> {selectedNode.name}</p>
                  <p><span className="font-semibold text-[#0A0A0A]">Credits:</span> {selectedNode.credits}</p>
                  <p><span className="font-semibold text-[#0A0A0A]">Lecturer Assignment:</span> Pending assignment (placeholder)</p>
                </div>
              ) : childRows.length > 0 ? (
                <div className="space-y-3">
                  {childRows.map((row) => (
                    <button
                      className={[
                        "w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200",
                        selected?.path[selected.path.length - 1] === row.id
                          ? "border-[#034AA6]/35 bg-[#034AA6]/10"
                          : "border-[#26150F]/20 bg-white hover:border-[#034AA6]/60",
                      ].join(" ")}
                      key={row.id}
                      onClick={() => {
                        if (!selected) return;
                        const nextPath = [...selected.path, row.id];
                        setSelected({ path: nextPath });
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          for (const id of nextPath) next.add(id);
                          return next;
                        });
                      }}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[#0A0A0A]">{row.name}</p>
                          <p className="mt-1 text-xs text-[#26150F]/70">
                            {row.code ? `${row.code}${row.credits ? ` • ${row.credits} credits` : ""}` : TYPE_LABEL[row.type]}
                          </p>
                        </div>
                        <Badge variant="neutral">{TYPE_LABEL[row.type]}</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-[#26150F]/18 bg-[#034AA6]/6 px-4 py-3 text-sm text-[#26150F]/75">
                  No items available under this node yet.
                </div>
              )}
            </div>
          </Card>
        </div>
      </section>

      {modalView ? (
        <AdminModal
          description={
            modalView.mode === "add"
              ? `Provide details to create a ${TYPE_LABEL[
                  modalView.targetType
                ].toLowerCase()}.`
              : `Update ${TYPE_LABEL[modalView.targetType].toLowerCase()} details.`
          }
          footer={
            <div className="flex items-center justify-between gap-3">
              <Button
                className="min-h-10 rounded-xl px-4"
                onClick={closeModal}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
              <Button className="min-h-10 rounded-xl px-5" type="submit" form="faculty-modal-form">
                {modalView.mode === "add" ? "Create" : "Save Changes"}
              </Button>
            </div>
          }
          icon={(() => {
            const Icon = TYPE_ICON[modalView.targetType];
            return <Icon size={18} />;
          })()}
          onClose={closeModal}
          open={modalOpen}
          title={`${modalView.mode === "add" ? "Add" : "Edit"} ${TYPE_LABEL[
            modalView.targetType
          ]}`}
        >
          <form className="space-y-4" id="faculty-modal-form" onSubmit={handleSave}>
            {modalView.targetType === "BADGE" ||
            modalView.targetType === "YEAR" ||
            modalView.targetType === "SEMESTER" ? (
              <div>
                <label className="text-sm font-medium text-[#26150F]" htmlFor="node-name">
                  {modalView.targetType === "BADGE"
                    ? "Badge Label"
                    : modalView.targetType === "YEAR"
                      ? "Year Label"
                      : "Semester Label"}
                </label>
                {modalView.targetType === "SEMESTER" ? (
                  <select
                    className="mt-1 w-full rounded-[16px] border border-border bg-card px-3.5 py-2.5 text-sm text-text transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    id="node-name"
                    onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
                    value={values.name}
                  >
                    <option value="">Select semester</option>
                    {SEMESTER_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="node-name"
                    onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder={
                      modalView.targetType === "BADGE" ? "e.g., 2026" : "e.g., 1st Year"
                    }
                    value={values.name}
                  />
                )}
                {errors.name ? <p className="mt-1 text-xs text-[#0339A6]">{errors.name}</p> : null}
              </div>
            ) : null}

            {modalView.targetType === "FACULTY" || modalView.targetType === "PROGRAM" ? (
              <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
                <div>
                  <label className="text-sm font-medium text-[#26150F]" htmlFor="node-name">
                    Name
                  </label>
                  <Input
                    id="node-name"
                    onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder={
                      modalView.targetType === "FACULTY" ? "Faculty name" : "Program name"
                    }
                    value={values.name}
                  />
                  {errors.name ? <p className="mt-1 text-xs text-[#0339A6]">{errors.name}</p> : null}
                </div>
                <div>
                  <label className="text-sm font-medium text-[#26150F]" htmlFor="node-code">
                    {modalView.targetType === "FACULTY" ? "Short Code" : "Program Code"}
                  </label>
                  <Input
                    id="node-code"
                    onChange={(event) => setValues((prev) => ({ ...prev, code: event.target.value }))}
                    placeholder={modalView.targetType === "FACULTY" ? "e.g., FOC" : "e.g., CS"}
                    value={values.code}
                  />
                  {errors.code ? <p className="mt-1 text-xs text-[#0339A6]">{errors.code}</p> : null}
                </div>
              </div>
            ) : null}

            {modalView.targetType === "MODULE" ? (
              <div className="space-y-4">
                <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
                  <div>
                    <label className="text-sm font-medium text-[#26150F]" htmlFor="node-name">
                      Module Name
                    </label>
                    <Input
                      id="node-name"
                      onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Module name"
                      value={values.name}
                    />
                    {errors.name ? <p className="mt-1 text-xs text-[#0339A6]">{errors.name}</p> : null}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#26150F]" htmlFor="node-code">
                      Module Code
                    </label>
                    <Input
                      id="node-code"
                      onChange={(event) => setValues((prev) => ({ ...prev, code: event.target.value }))}
                      placeholder="e.g., CS-26110"
                      value={values.code}
                    />
                    {errors.code ? <p className="mt-1 text-xs text-[#0339A6]">{errors.code}</p> : null}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#26150F]" htmlFor="node-credits">
                    Credits
                  </label>
                  <Input
                    id="node-credits"
                    min="1"
                    onChange={(event) => setValues((prev) => ({ ...prev, credits: event.target.value }))}
                    placeholder="e.g., 3"
                    type="number"
                    value={values.credits}
                  />
                  {errors.credits ? <p className="mt-1 text-xs text-[#0339A6]">{errors.credits}</p> : null}
                </div>
              </div>
            ) : null}
          </form>
        </AdminModal>
      ) : null}
    </div>
  );
}

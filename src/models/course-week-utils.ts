import { findIntakeById, sanitizeTermCode, type IntakeRecord, type TermCode } from "@/models/intake-store";
import { findModuleByCode, findModuleById } from "@/models/module-store";

export interface CourseWeekResourceItem {
  id: string;
  title: string;
  url: string;
  description: string;
}

export interface CourseWeekAssignmentItem {
  id: string;
  title: string;
  description: string;
  link: string;
}

export interface CourseWeekTodoItem {
  id: string;
  text: string;
}

export interface CourseWeekContentRecord {
  weekNo: number;
  outline: string;
  lectureSlides: CourseWeekResourceItem[];
  resources: CourseWeekResourceItem[];
  assignments: CourseWeekAssignmentItem[];
  todoItems: CourseWeekTodoItem[];
  updatedAt: string;
}

export interface IntakeWeekRangeRecord {
  weekNo: number;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
}

export interface CourseMergedWeekRecord extends IntakeWeekRangeRecord {
  outline: string;
  lectureSlides: CourseWeekResourceItem[];
  resources: CourseWeekResourceItem[];
  assignments: CourseWeekAssignmentItem[];
  todoItems: CourseWeekTodoItem[];
  updatedAt: string;
}

export interface IntakeTermWeekContext {
  intake: IntakeRecord;
  termCode: TermCode;
  weekRanges: IntakeWeekRangeRecord[];
  currentWeekNo: number | null;
}

export interface CourseOfferingRecord {
  id: string;
  facultyCode: string;
  degreeCode: string;
  intakeId: string;
  intakeName: string;
  termCode: TermCode;
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  status: string;
  assignedLecturerIds: string[];
  outlineByWeek: Map<number, string>;
  weekContentsByWeek: Map<number, CourseWeekContentRecord>;
  weekContentsList: CourseWeekContentRecord[];
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function readId(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const row = value as {
      _id?: unknown;
      id?: unknown;
      lecturerId?: unknown;
      assistantId?: unknown;
      toString?: () => string;
    };
    const nested = String(
      row._id ?? row.id ?? row.lecturerId ?? row.assistantId ?? ""
    ).trim();
    if (nested) {
      return nested;
    }
    const rendered = typeof row.toString === "function" ? row.toString() : "";
    return rendered === "[object Object]" ? "" : rendered.trim();
  }

  return "";
}

function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function normalizeModuleCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

function sanitizeWeekNo(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.max(1, Math.min(60, Math.floor(parsed)));
}

function asDateOnly(value: string) {
  const clean = String(value ?? "").trim();
  if (!clean) {
    return null;
  }
  const parsed = clean.includes("T")
    ? new Date(clean)
    : new Date(`${clean}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const base = asDateOnly(value);
  if (!base) {
    return "";
  }
  base.setUTCDate(base.getUTCDate() + days);
  return formatDateOnly(base);
}

function compareDateOnly(left: string, right: string) {
  const leftDate = asDateOnly(left);
  const rightDate = asDateOnly(right);
  if (!leftDate || !rightDate) {
    return 0;
  }
  return leftDate.getTime() - rightDate.getTime();
}

function sanitizeDateOnly(value: unknown) {
  const parsed = asDateOnly(String(value ?? "").trim());
  return parsed ? formatDateOnly(parsed) : "";
}

function todayDateOnly() {
  return formatDateOnly(new Date());
}

function sanitizeResourceList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as CourseWeekResourceItem[];
  }

  const byId = new Map<string, CourseWeekResourceItem>();
  value.forEach((item) => {
    const row = asObject(item);
    const title = collapseSpaces(row?.title ?? row?.name ?? row?.label);
    const url = collapseSpaces(row?.url ?? row?.link);
    const description = collapseSpaces(row?.description);
    const id = collapseSpaces(row?.id) || `res-${Math.random().toString(36).slice(2, 10)}`;
    if (!title && !url) {
      return;
    }
    byId.set(id, {
      id,
      title: title || url,
      url,
      description,
    });
  });

  return Array.from(byId.values());
}

function sanitizeAssignmentList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as CourseWeekAssignmentItem[];
  }

  const byId = new Map<string, CourseWeekAssignmentItem>();
  value.forEach((item) => {
    const row = asObject(item);
    const title = collapseSpaces(row?.title ?? row?.name ?? row?.label);
    const description = collapseSpaces(row?.description ?? row?.details);
    const link = collapseSpaces(row?.link ?? row?.url);
    const id = collapseSpaces(row?.id) || `asg-${Math.random().toString(36).slice(2, 10)}`;
    if (!title && !description && !link) {
      return;
    }
    byId.set(id, {
      id,
      title: title || "Assignment",
      description,
      link,
    });
  });

  return Array.from(byId.values());
}

function sanitizeTodoList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as CourseWeekTodoItem[];
  }

  const byId = new Map<string, CourseWeekTodoItem>();
  value.forEach((item) => {
    const row = asObject(item);
    const text = collapseSpaces(row?.text ?? row?.title ?? item);
    if (!text) {
      return;
    }
    const id = collapseSpaces(row?.id) || `todo-${Math.random().toString(36).slice(2, 10)}`;
    byId.set(id, { id, text });
  });

  return Array.from(byId.values());
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

export function normalizeWeekContents(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as CourseWeekContentRecord[];
  }

  const byWeek = new Map<number, CourseWeekContentRecord>();
  value.forEach((item) => {
    const row = asObject(item);
    if (!row) {
      return;
    }
    const weekNo = sanitizeWeekNo(row.weekNo);
    byWeek.set(weekNo, {
      weekNo,
      outline: collapseSpaces(row.outline),
      lectureSlides: sanitizeResourceList(row.lectureSlides),
      resources: sanitizeResourceList(row.resources),
      assignments: sanitizeAssignmentList(row.assignments),
      todoItems: sanitizeTodoList(row.todoItems),
      updatedAt: toIsoDate(row.updatedAt) || new Date().toISOString(),
    });
  });

  return Array.from(byWeek.values()).sort((left, right) => left.weekNo - right.weekNo);
}

function resolveTemplateOutlineByWeek(input: {
  moduleId: string;
  moduleCode: string;
}) {
  const byWeek = new Map<number, string>();
  const moduleRecord =
    findModuleById(input.moduleId) ?? findModuleByCode(input.moduleCode);
  if (!moduleRecord) {
    return byWeek;
  }

  moduleRecord.outlineTemplate.forEach((row) => {
    const title = collapseSpaces(row.title);
    if (!title) {
      return;
    }
    byWeek.set(sanitizeWeekNo(row.weekNo), title);
  });
  return byWeek;
}

function normalizeOutlineByWeek(value: unknown, fallback: Map<number, string>) {
  const byWeek = new Map<number, string>(fallback);
  if (!Array.isArray(value)) {
    return byWeek;
  }

  value.forEach((item) => {
    const row = asObject(item);
    if (!row) {
      return;
    }
    const title = collapseSpaces(row.title);
    if (!title) {
      return;
    }
    byWeek.set(sanitizeWeekNo(row.weekNo), title);
  });

  return byWeek;
}

function parseAssignedLecturerIds(value: unknown, fallback: unknown) {
  const merged = [
    ...(Array.isArray(value) ? value : []),
    ...(Array.isArray(fallback) ? fallback : []),
  ];

  return Array.from(
    new Set(
      merged
        .map((item) => readId(item))
        .filter(Boolean)
    )
  );
}

export function normalizeCourseOffering(value: unknown): CourseOfferingRecord | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = readId(row._id ?? row.id);
  const termCode = sanitizeTermCode(row.termCode);
  if (!id || !termCode) {
    return null;
  }

  const intakeId = collapseSpaces(row.intakeId);
  const intakeName = collapseSpaces(row.intakeName) || intakeId;
  const moduleId = collapseSpaces(row.moduleId);
  const moduleCode = normalizeModuleCode(row.moduleCode ?? row.moduleId);
  if (!moduleCode || (!intakeId && !intakeName)) {
    return null;
  }

  const weekContentsList = normalizeWeekContents(row.weekContents);
  const weekContentsByWeek = new Map(
    weekContentsList.map((item) => [item.weekNo, item] as const)
  );
  const templateOutline = resolveTemplateOutlineByWeek({
    moduleId,
    moduleCode,
  });

  return {
    id,
    facultyCode: normalizeAcademicCode(row.facultyCode ?? row.facultyId),
    degreeCode: normalizeAcademicCode(row.degreeCode ?? row.degreeProgramId),
    intakeId: intakeId || intakeName,
    intakeName,
    termCode,
    moduleId: moduleId || moduleCode,
    moduleCode,
    moduleName: collapseSpaces(row.moduleName) || moduleCode,
    status: collapseSpaces(row.status).toUpperCase() || "ACTIVE",
    assignedLecturerIds: parseAssignedLecturerIds(
      row.assignedLecturerIds,
      row.assignedLecturers
    ),
    outlineByWeek: normalizeOutlineByWeek(row.outlineWeeks, templateOutline),
    weekContentsByWeek,
    weekContentsList,
  };
}

function weeksFromDateRange(startDate: string, endDate: string) {
  const start = asDateOnly(startDate);
  const end = asDateOnly(endDate);
  if (!start || !end) {
    return 0;
  }
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) {
    return 0;
  }
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.ceil(diffDays / 7));
}

export function buildTermWeekRanges(input: {
  startDate: string;
  endDate: string;
  weeks: number;
  today?: string;
}) {
  const startDate = sanitizeDateOnly(input.startDate);
  const endDate = sanitizeDateOnly(input.endDate);
  if (!startDate) {
    return [] as IntakeWeekRangeRecord[];
  }

  const rangeWeeks = endDate ? weeksFromDateRange(startDate, endDate) : 0;
  const configuredWeeks = Math.max(1, Math.min(60, Math.floor(Number(input.weeks) || 1)));
  const weekCount = Math.max(configuredWeeks, rangeWeeks);
  const today = sanitizeDateOnly(input.today) || todayDateOnly();

  return Array.from({ length: weekCount }, (_, index) => {
    const weekNo = index + 1;
    const weekStart = addDays(startDate, index * 7);
    const naturalEnd = addDays(weekStart, 6);
    const weekEnd =
      endDate && compareDateOnly(naturalEnd, endDate) > 0 ? endDate : naturalEnd;
    const isCurrent =
      compareDateOnly(today, weekStart) >= 0 && compareDateOnly(today, weekEnd) <= 0;
    const isPast = compareDateOnly(today, weekEnd) > 0;
    const isFuture = compareDateOnly(today, weekStart) < 0;

    return {
      weekNo,
      startDate: weekStart,
      endDate: weekEnd,
      isCurrent,
      isPast,
      isFuture,
    } satisfies IntakeWeekRangeRecord;
  });
}

export function resolveIntakeTermWeekContext(input: {
  intakeId: string;
  termCode: TermCode;
  today?: string;
}) {
  const intake = findIntakeById(input.intakeId);
  if (!intake) {
    return null;
  }

  const termCode = sanitizeTermCode(input.termCode);
  const schedule =
    intake.termSchedules.find((row) => row.termCode === termCode) ?? null;
  if (!schedule) {
    return {
      intake,
      termCode,
      weekRanges: [],
      currentWeekNo: null,
    } satisfies IntakeTermWeekContext;
  }

  const weekRanges = buildTermWeekRanges({
    startDate: schedule.startDate,
    endDate: schedule.endDate,
    weeks: schedule.weeks,
    today: input.today,
  });
  const currentWeekNo = weekRanges.find((item) => item.isCurrent)?.weekNo ?? null;

  return {
    intake,
    termCode,
    weekRanges,
    currentWeekNo,
  } satisfies IntakeTermWeekContext;
}

function deriveWeekRangeForIndex(
  weekNo: number,
  baseRanges: IntakeWeekRangeRecord[],
  today: string
) {
  const existing = baseRanges.find((item) => item.weekNo === weekNo);
  if (existing) {
    return existing;
  }

  const firstWeek = baseRanges[0];
  if (!firstWeek?.startDate) {
    return {
      weekNo,
      startDate: "",
      endDate: "",
      isCurrent: false,
      isPast: false,
      isFuture: false,
    } satisfies IntakeWeekRangeRecord;
  }

  const startDate = addDays(firstWeek.startDate, (weekNo - 1) * 7);
  const endDate = addDays(startDate, 6);

  return {
    weekNo,
    startDate,
    endDate,
    isCurrent:
      compareDateOnly(today, startDate) >= 0 && compareDateOnly(today, endDate) <= 0,
    isPast: compareDateOnly(today, endDate) > 0,
    isFuture: compareDateOnly(today, startDate) < 0,
  } satisfies IntakeWeekRangeRecord;
}

function maxWeekNumber(...values: Array<number>) {
  return values.reduce((max, current) => Math.max(max, current), 1);
}

export function mergeCourseWeeks(input: {
  weekRanges: IntakeWeekRangeRecord[];
  outlineByWeek: Map<number, string>;
  weekContentsByWeek: Map<number, CourseWeekContentRecord>;
  today?: string;
}) {
  const today = sanitizeDateOnly(input.today) || todayDateOnly();
  const highestOutlineWeek = Math.max(1, ...Array.from(input.outlineByWeek.keys(), (value) => sanitizeWeekNo(value)));
  const highestContentWeek = Math.max(1, ...Array.from(input.weekContentsByWeek.keys(), (value) => sanitizeWeekNo(value)));
  const highestRangeWeek = input.weekRanges.length > 0 ? input.weekRanges[input.weekRanges.length - 1].weekNo : 1;
  const totalWeeks = maxWeekNumber(highestOutlineWeek, highestContentWeek, highestRangeWeek);

  const weeks = Array.from({ length: totalWeeks }, (_, index) => {
    const weekNo = index + 1;
    const range = deriveWeekRangeForIndex(weekNo, input.weekRanges, today);
    const content = input.weekContentsByWeek.get(weekNo);
    const outline =
      collapseSpaces(content?.outline) ||
      collapseSpaces(input.outlineByWeek.get(weekNo)) ||
      `Week ${weekNo}`;

    return {
      ...range,
      outline,
      lectureSlides: content?.lectureSlides ?? [],
      resources: content?.resources ?? [],
      assignments: content?.assignments ?? [],
      todoItems: content?.todoItems ?? [],
      updatedAt: content?.updatedAt ?? "",
    } satisfies CourseMergedWeekRecord;
  });

  return weeks;
}

export function hasWeekContentPayload(week: CourseWeekContentRecord | null | undefined) {
  if (!week) {
    return false;
  }

  return Boolean(
    collapseSpaces(week.outline) ||
      week.lectureSlides.length > 0 ||
      week.resources.length > 0 ||
      week.assignments.length > 0 ||
      week.todoItems.length > 0
  );
}

export function hasAnyWeekContent(weekContents: CourseWeekContentRecord[]) {
  return weekContents.some((item) => hasWeekContentPayload(item));
}

export function isLecturerAssignedToOffering(
  offering: Pick<CourseOfferingRecord, "assignedLecturerIds">,
  lecturerId: string
) {
  const targetId = readId(lecturerId);
  if (!targetId) {
    return false;
  }

  return offering.assignedLecturerIds.includes(targetId);
}

export function sanitizeWeekContentInput(value: unknown) {
  const row = asObject(value) ?? {};
  const weekNo = sanitizeWeekNo(row.weekNo);

  return {
    weekNo,
    outline: collapseSpaces(row.outline),
    lectureSlides: sanitizeResourceList(row.lectureSlides),
    resources: sanitizeResourceList(row.resources),
    assignments: sanitizeAssignmentList(row.assignments),
    todoItems: sanitizeTodoList(row.todoItems),
    updatedAt: new Date().toISOString(),
  } satisfies CourseWeekContentRecord;
}

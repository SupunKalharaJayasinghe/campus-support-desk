import { findDegreeProgram } from "@/models/degree-program-store";
import { findFaculty } from "@/models/faculty-store";

export type IntakeStatus = "ACTIVE" | "INACTIVE" | "DRAFT";
export type IntakeSort = "updated" | "created" | "az" | "za";
export type TermCode =
  | "Y1S1"
  | "Y1S2"
  | "Y2S1"
  | "Y2S2"
  | "Y3S1"
  | "Y3S2"
  | "Y4S1"
  | "Y4S2";
export type NotifyBeforeDays = 1 | 3 | 7;
export type TermScheduleStatus = "PAST" | "CURRENT" | "FUTURE";

export interface IntakeTermPoliciesRecord {
  autoJump: boolean;
  lockPastTerms: boolean;
  defaultWeeksPerTerm: number;
  defaultNotifyBeforeDays: NotifyBeforeDays;
  autoGenerateFutureTerms: boolean;
}

export interface IntakeTermScheduleRecord {
  termCode: TermCode;
  startDate: string;
  endDate: string;
  weeks: number;
  notifyBeforeDays: NotifyBeforeDays;
  isManuallyCustomized: boolean;
  notificationSentAt: string;
}

export interface IntakeNotificationRecord {
  id: string;
  termCode: TermCode;
  title: string;
  message: string;
  sentAt: string;
  target: string;
}

export interface IntakeRecord {
  id: string;
  name: string;
  facultyCode: string;
  degreeCode: string;
  intakeYear: number;
  intakeMonth: string;
  stream?: string;
  status: IntakeStatus;
  currentTerm: TermCode;
  autoJumpEnabled: boolean;
  lockPastTerms: boolean;
  defaultWeeksPerTerm: number;
  defaultNotifyBeforeDays: NotifyBeforeDays;
  autoGenerateFutureTerms: boolean;
  termSchedules: IntakeTermScheduleRecord[];
  notifications: IntakeNotificationRecord[];
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface IntakeTermPoliciesInput {
  autoJump?: boolean;
  lockPastTerms?: boolean;
  defaultWeeksPerTerm?: number;
  defaultNotifyBeforeDays?: NotifyBeforeDays;
  autoGenerateFutureTerms?: boolean;
}

export interface IntakeTermScheduleInput {
  termCode: TermCode;
  startDate: string;
  endDate?: string;
  weeks?: number;
  notifyBeforeDays: NotifyBeforeDays;
  isManuallyCustomized?: boolean;
  manuallyEdited?: boolean;
}

export interface IntakeDailyJobSummary {
  checkedIntakes: number;
  promotedIntakes: number;
  queuedNotifications: number;
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

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const DEFAULT_NOTIFY_BEFORE_DAYS: NotifyBeforeDays = 3;
const DEFAULT_AUTO_JUMP_ENABLED = true;
const DEFAULT_LOCK_PAST_TERMS = true;
const DEFAULT_AUTO_GENERATE_FUTURE_TERMS = true;
const DEFAULT_TERM_WEEKS = 16;
const DEFAULT_WEEKS_OPTIONS = [12, 14, 16, 18] as const;

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function todayDateOnly() {
  return formatDateOnly(new Date());
}

function asDate(value: string) {
  if (!value) return null;

  const parsed = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
}

function monthOrder(month: string) {
  const index = MONTHS.findIndex((value) => value === month);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function collapseSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseIntakeName(input: string) {
  const normalizedName = collapseSpaces(input);
  const match = normalizedName.match(/(\d{4})\s+([A-Za-z]+)/);
  if (!match) {
    return {
      name: normalizedName,
      intakeYear: 0,
      intakeMonth: "",
    };
  }

  const intakeYear = Number(match[1]);
  const monthInput = String(match[2] ?? "").toLowerCase();
  const intakeMonth =
    MONTHS.find((month) => month.toLowerCase().startsWith(monthInput)) ?? "";

  return {
    name: normalizedName,
    intakeYear: Number.isFinite(intakeYear) ? intakeYear : 0,
    intakeMonth,
  };
}

function intakeLabel(record: Pick<IntakeRecord, "name" | "intakeYear" | "intakeMonth">) {
  if (record.name) {
    return record.name;
  }

  return `${record.intakeYear} ${record.intakeMonth}`.trim();
}

function addDaysToDateOnly(value: string, days: number) {
  const base = asDate(value);
  if (!base) return "";
  base.setUTCDate(base.getUTCDate() + days);
  return formatDateOnly(base);
}

function addMonthsToDateOnly(value: string, months: number) {
  const base = asDate(value);
  if (!base) return "";
  base.setUTCMonth(base.getUTCMonth() + months);
  return formatDateOnly(base);
}

function compareDateOnly(left: string, right: string) {
  const leftDate = asDate(left);
  const rightDate = asDate(right);
  if (!leftDate || !rightDate) return 0;
  return leftDate.getTime() - rightDate.getTime();
}

function termIndex(termCode: TermCode) {
  return TERM_SEQUENCE.findIndex((item) => item === termCode);
}

function calculateEndDateFromWeeks(startDate: string, weeks: number) {
  if (!startDate) return "";
  return addDaysToDateOnly(startDate, Math.max(1, weeks) * 7 - 1);
}

function weeksFromDateRange(startDate: string, endDate: string) {
  const start = asDate(startDate);
  const end = asDate(endDate);
  if (!start || !end) {
    return DEFAULT_TERM_WEEKS;
  }

  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) {
    return DEFAULT_TERM_WEEKS;
  }

  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.ceil(days / 7));
}

function sanitizeWeeksCount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_TERM_WEEKS;
  }

  return Math.max(1, Math.min(52, Math.floor(parsed)));
}

export function sanitizeDefaultWeeksPerTerm(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_TERM_WEEKS;
  }

  const next = Math.floor(parsed);
  return DEFAULT_WEEKS_OPTIONS.includes(next as (typeof DEFAULT_WEEKS_OPTIONS)[number])
    ? next
    : DEFAULT_TERM_WEEKS;
}

function emptyTermSchedule(termCode: TermCode): IntakeTermScheduleRecord {
  return {
    termCode,
    startDate: "",
    endDate: "",
    weeks: DEFAULT_TERM_WEEKS,
    notifyBeforeDays: DEFAULT_NOTIFY_BEFORE_DAYS,
    isManuallyCustomized: false,
    notificationSentAt: "",
  };
}

function sanitizeNotificationSentAt(value: unknown) {
  const input = String(value ?? "").trim();
  if (!input) return "";
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

function normalizeScheduleRow(
  value: IntakeTermScheduleInput | IntakeTermScheduleRecord | undefined,
  fallbackTerm: TermCode
): IntakeTermScheduleRecord {
  const termCode = sanitizeTermCode(value?.termCode ?? fallbackTerm);
  const startDate = sanitizeDateField(value?.startDate);
  const weeks = sanitizeWeeksCount(
    (value as IntakeTermScheduleRecord | IntakeTermScheduleInput | undefined)?.weeks
  );
  const endDate = startDate
    ? calculateEndDateFromWeeks(startDate, weeks)
    : sanitizeDateField(value?.endDate);

  return {
    termCode,
    startDate,
    endDate,
    weeks,
    notifyBeforeDays: sanitizeNotifyBeforeDays(value?.notifyBeforeDays),
    isManuallyCustomized:
      value?.isManuallyCustomized === true ||
      (value as IntakeTermScheduleInput | undefined)?.manuallyEdited === true,
    notificationSentAt: sanitizeNotificationSentAt(
      (value as IntakeTermScheduleRecord | undefined)?.notificationSentAt
    ),
  };
}

function normalizeSchedules(
  schedules: Array<IntakeTermScheduleInput | IntakeTermScheduleRecord> | undefined
) {
  const byTerm = new Map<TermCode, IntakeTermScheduleInput | IntakeTermScheduleRecord>();

  (schedules ?? []).forEach((schedule) => {
    const termCode = sanitizeTermCode(schedule.termCode);
    byTerm.set(termCode, schedule);
  });

  return TERM_SEQUENCE.map((termCode) =>
    normalizeScheduleRow(byTerm.get(termCode), termCode)
  );
}

function applyPolicyDefaultsToSchedules(
  schedules: IntakeTermScheduleRecord[],
  defaults: Pick<
    IntakeTermPoliciesRecord,
    "defaultWeeksPerTerm" | "defaultNotifyBeforeDays"
  >
) {
  const defaultWeeks = sanitizeDefaultWeeksPerTerm(defaults.defaultWeeksPerTerm);
  const defaultNotify = sanitizeNotifyBeforeDays(defaults.defaultNotifyBeforeDays);

  return schedules.map((schedule) => {
    const weeks = sanitizeWeeksCount(schedule.weeks || defaultWeeks);
    const notifyBeforeDays = sanitizeNotifyBeforeDays(
      schedule.notifyBeforeDays || defaultNotify
    );
    const endDate = schedule.startDate
      ? calculateEndDateFromWeeks(schedule.startDate, weeks)
      : schedule.endDate;

    return {
      ...schedule,
      weeks,
      notifyBeforeDays,
      endDate,
    };
  });
}

function resolveIntakePolicies(intake: IntakeRecord): IntakeTermPoliciesRecord {
  return {
    autoJump: intake.autoJumpEnabled !== false,
    lockPastTerms: intake.lockPastTerms !== false,
    defaultWeeksPerTerm: sanitizeDefaultWeeksPerTerm(
      intake.defaultWeeksPerTerm ?? DEFAULT_TERM_WEEKS
    ),
    defaultNotifyBeforeDays: sanitizeNotifyBeforeDays(
      intake.defaultNotifyBeforeDays ?? DEFAULT_NOTIFY_BEFORE_DAYS
    ),
    autoGenerateFutureTerms: intake.autoGenerateFutureTerms !== false,
  };
}

function normalizeIntakeRecord(input: IntakeRecord): IntakeRecord {
  const policies = resolveIntakePolicies(input);
  const normalizedSchedules = normalizeSchedules(
    Array.isArray(input.termSchedules) ? input.termSchedules : []
  );
  const termSchedules = applyPolicyDefaultsToSchedules(normalizedSchedules, {
    defaultWeeksPerTerm: policies.defaultWeeksPerTerm,
    defaultNotifyBeforeDays: policies.defaultNotifyBeforeDays,
  });

  return {
    ...input,
    autoJumpEnabled: policies.autoJump,
    lockPastTerms: policies.lockPastTerms,
    defaultWeeksPerTerm: policies.defaultWeeksPerTerm,
    defaultNotifyBeforeDays: policies.defaultNotifyBeforeDays,
    autoGenerateFutureTerms: policies.autoGenerateFutureTerms,
    termSchedules,
  };
}

function getTermScheduleStatus(
  schedule: Pick<IntakeTermScheduleRecord, "startDate" | "endDate">,
  today: string
): TermScheduleStatus {
  if (schedule.endDate && compareDateOnly(schedule.endDate, today) < 0) {
    return "PAST";
  }

  if (
    schedule.startDate &&
    schedule.endDate &&
    compareDateOnly(schedule.startDate, today) <= 0 &&
    compareDateOnly(schedule.endDate, today) >= 0
  ) {
    return "CURRENT";
  }

  return "FUTURE";
}

function autoGenerateFutureSchedules(
  schedules: IntakeTermScheduleRecord[],
  options?: {
    force?: boolean;
    today?: string;
  }
) {
  const today = options?.today ?? todayDateOnly();
  const force = options?.force === true;
  const baseline = schedules[0];

  if (!baseline?.startDate) {
    return schedules;
  }

  const baselineWeeks = sanitizeWeeksCount(baseline.weeks);

  return schedules.map((schedule, index) => {
    if (index === 0) {
      if (!schedule.startDate || getTermScheduleStatus(schedule, today) === "PAST") {
        return schedule;
      }

      return {
        ...schedule,
        weeks: baselineWeeks,
        endDate: calculateEndDateFromWeeks(schedule.startDate, baselineWeeks),
      };
    }

    const status = getTermScheduleStatus(schedule, today);
    if (status !== "FUTURE") {
      return schedule;
    }

    if (!force && schedule.isManuallyCustomized) {
      return schedule;
    }

    const nextStart = addMonthsToDateOnly(baseline.startDate, index * 6);
    const nextWeeks = sanitizeWeeksCount(schedule.weeks || baselineWeeks);

    return {
      ...schedule,
      startDate: nextStart || schedule.startDate,
      weeks: nextWeeks,
      endDate: nextStart
        ? calculateEndDateFromWeeks(nextStart, nextWeeks)
        : schedule.endDate,
      isManuallyCustomized: false,
      notificationSentAt: "",
    };
  });
}

function mergeSchedulesPreservingPast(
  existing: IntakeTermScheduleRecord[],
  incoming: IntakeTermScheduleInput[],
  options?: {
    today?: string;
    autoGenerateFutureTerms?: boolean;
    recalculateFutureTerms?: boolean;
    lockPastTerms?: boolean;
  }
) {
  const today = options?.today ?? todayDateOnly();
  const lockPastTerms = options?.lockPastTerms !== false;
  const currentRows = normalizeSchedules(existing);
  const nextRows = normalizeSchedules(incoming);

  const merged = TERM_SEQUENCE.map((termCode, index) => {
    const currentRow = currentRows[index];
    const incomingRow = nextRows[index];

    if (lockPastTerms && getTermScheduleStatus(currentRow, today) === "PAST") {
      return currentRow;
    }

    const keepNotificationStamp =
      currentRow.notificationSentAt &&
      currentRow.startDate === incomingRow.startDate &&
      currentRow.notifyBeforeDays === incomingRow.notifyBeforeDays;

    return {
      ...incomingRow,
      termCode,
      endDate: incomingRow.startDate
        ? calculateEndDateFromWeeks(incomingRow.startDate, incomingRow.weeks)
        : incomingRow.endDate,
      notificationSentAt: keepNotificationStamp
        ? currentRow.notificationSentAt
        : "",
    };
  });

  if (options?.autoGenerateFutureTerms) {
    return autoGenerateFutureSchedules(merged, {
      force: options.recalculateFutureTerms,
      today,
    });
  }

  return merged;
}

function buildSequentialSchedule(
  y1s1StartDate: string,
  weeks = DEFAULT_TERM_WEEKS
): IntakeTermScheduleRecord[] {
  return TERM_SEQUENCE.map((termCode, index) => {
    const startDate = addMonthsToDateOnly(y1s1StartDate, index * 6);
    const termWeeks = sanitizeWeeksCount(weeks);

    return {
      termCode,
      startDate,
      endDate: calculateEndDateFromWeeks(startDate, termWeeks),
      weeks: termWeeks,
      notifyBeforeDays: DEFAULT_NOTIFY_BEFORE_DAYS,
      isManuallyCustomized: false,
      notificationSentAt: "",
    };
  });
}

const INITIAL_INTAKES: IntakeRecord[] = [
  {
    id: "intk-2026-june-foc-se",
    name: "2026 June",
    facultyCode: "FOC",
    degreeCode: "SE",
    intakeYear: 2026,
    intakeMonth: "June",
    status: "ACTIVE",
    currentTerm: "Y1S1",
    autoJumpEnabled: true,
    lockPastTerms: true,
    defaultWeeksPerTerm: 16,
    defaultNotifyBeforeDays: 3,
    autoGenerateFutureTerms: true,
    termSchedules: buildSequentialSchedule("2026-06-02", 16),
    notifications: [],
    createdAt: "2025-12-05T09:00:00.000Z",
    updatedAt: "2026-02-28T09:00:00.000Z",
    isDeleted: false,
  },
  {
    id: "intk-2026-october-foc-se",
    name: "2026 October",
    facultyCode: "FOC",
    degreeCode: "SE",
    intakeYear: 2026,
    intakeMonth: "October",
    status: "ACTIVE",
    currentTerm: "Y1S1",
    autoJumpEnabled: true,
    lockPastTerms: true,
    defaultWeeksPerTerm: 16,
    defaultNotifyBeforeDays: 3,
    autoGenerateFutureTerms: true,
    termSchedules: buildSequentialSchedule("2026-10-05", 16),
    notifications: [],
    createdAt: "2026-01-09T09:00:00.000Z",
    updatedAt: "2026-02-20T09:00:00.000Z",
    isDeleted: false,
  },
  {
    id: "intk-2027-february-foc-se",
    name: "2027 February",
    facultyCode: "FOC",
    degreeCode: "SE",
    intakeYear: 2027,
    intakeMonth: "February",
    status: "DRAFT",
    currentTerm: "Y1S1",
    autoJumpEnabled: true,
    lockPastTerms: true,
    defaultWeeksPerTerm: 16,
    defaultNotifyBeforeDays: 3,
    autoGenerateFutureTerms: true,
    termSchedules: buildSequentialSchedule("2027-02-08", 16),
    notifications: [],
    createdAt: "2026-03-01T09:00:00.000Z",
    updatedAt: "2026-03-01T09:00:00.000Z",
    isDeleted: false,
  },
  {
    id: "intk-2026-june-foc-cs",
    name: "2026 June",
    facultyCode: "FOC",
    degreeCode: "CS",
    intakeYear: 2026,
    intakeMonth: "June",
    status: "ACTIVE",
    currentTerm: "Y1S2",
    autoJumpEnabled: true,
    lockPastTerms: true,
    defaultWeeksPerTerm: 16,
    defaultNotifyBeforeDays: 3,
    autoGenerateFutureTerms: true,
    termSchedules: buildSequentialSchedule("2026-06-01", 16),
    notifications: [],
    createdAt: "2025-12-09T09:00:00.000Z",
    updatedAt: "2026-03-02T09:00:00.000Z",
    isDeleted: false,
  },
  {
    id: "intk-2026-june-foe-ce",
    name: "2026 June",
    facultyCode: "FOE",
    degreeCode: "CE",
    intakeYear: 2026,
    intakeMonth: "June",
    status: "ACTIVE",
    currentTerm: "Y1S1",
    autoJumpEnabled: true,
    lockPastTerms: true,
    defaultWeeksPerTerm: 16,
    defaultNotifyBeforeDays: 3,
    autoGenerateFutureTerms: true,
    termSchedules: buildSequentialSchedule("2026-06-10", 16),
    notifications: [],
    createdAt: "2025-11-18T09:00:00.000Z",
    updatedAt: "2026-02-24T09:00:00.000Z",
    isDeleted: false,
  },
  {
    id: "intk-2026-june-fob-biz",
    name: "2026 June",
    facultyCode: "FOB",
    degreeCode: "BIZ",
    intakeYear: 2026,
    intakeMonth: "June",
    status: "INACTIVE",
    currentTerm: "Y1S1",
    autoJumpEnabled: false,
    lockPastTerms: true,
    defaultWeeksPerTerm: 16,
    defaultNotifyBeforeDays: 3,
    autoGenerateFutureTerms: true,
    termSchedules: buildSequentialSchedule("2026-06-12", 16),
    notifications: [],
    createdAt: "2025-11-25T09:00:00.000Z",
    updatedAt: "2026-01-11T09:00:00.000Z",
    isDeleted: false,
  },
];

const globalForIntakeStore = globalThis as typeof globalThis & {
  __intakeStore?: IntakeRecord[];
};

function intakeStore() {
  if (!globalForIntakeStore.__intakeStore) {
    globalForIntakeStore.__intakeStore = INITIAL_INTAKES.map((item) =>
      normalizeIntakeRecord({
        ...item,
        termSchedules: item.termSchedules.map((schedule) => ({ ...schedule })),
        notifications: item.notifications.map((notification) => ({ ...notification })),
      })
    );
  }

  return globalForIntakeStore.__intakeStore;
}

function createNotificationRecord(
  intake: IntakeRecord,
  termCode: TermCode,
  startDate: string
): IntakeNotificationRecord {
  const title = `${termCode} Starts Tomorrow`;
  const message = `Your semester ${termCode} starts on ${startDate}. Check timetable and modules.`;

  const audienceScope = [
    intake.facultyCode,
    intake.degreeCode,
    intakeLabel(intake),
    intake.stream ?? "",
  ]
    .filter(Boolean)
    .join(" / ");

  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    termCode,
    title,
    message,
    sentAt: new Date().toISOString(),
    target: audienceScope,
  };
}

function runDailyIntakeChecks(today: string): IntakeDailyJobSummary {
  const summary: IntakeDailyJobSummary = {
    checkedIntakes: 0,
    promotedIntakes: 0,
    queuedNotifications: 0,
  };

  const store = intakeStore();

  for (let index = 0; index < store.length; index += 1) {
    const intake = store[index];
    if (intake.isDeleted) {
      continue;
    }

    summary.checkedIntakes += 1;
    let didChange = false;
    let nextIntake = { ...intake };
    let nextSchedules = intake.termSchedules.map((schedule) => ({ ...schedule }));

    nextSchedules = nextSchedules.map((schedule) => {
      if (!schedule.startDate) {
        return schedule;
      }

      const notifyDate = addDaysToDateOnly(
        schedule.startDate,
        -Math.abs(schedule.notifyBeforeDays)
      );
      const alreadySentToday =
        schedule.notificationSentAt &&
        schedule.notificationSentAt.slice(0, 10) === today;

      if (!notifyDate || notifyDate !== today || alreadySentToday) {
        return schedule;
      }

      const notification = createNotificationRecord(
        nextIntake,
        schedule.termCode,
        schedule.startDate
      );
      nextIntake = {
        ...nextIntake,
        notifications: [notification, ...nextIntake.notifications],
      };
      summary.queuedNotifications += 1;
      didChange = true;

      return {
        ...schedule,
        notificationSentAt: new Date().toISOString(),
      };
    });

    if (nextIntake.autoJumpEnabled) {
      const currentIndex = termIndex(nextIntake.currentTerm);
      if (currentIndex >= 0 && currentIndex < TERM_SEQUENCE.length - 1) {
        const currentSchedule = nextSchedules[currentIndex];

        if (
          currentSchedule?.endDate &&
          compareDateOnly(today, currentSchedule.endDate) >= 0
        ) {
          nextIntake = {
            ...nextIntake,
            currentTerm: TERM_SEQUENCE[currentIndex + 1],
          };
          summary.promotedIntakes += 1;
          didChange = true;
        }
      }
    }

    if (didChange) {
      store[index] = normalizeIntakeRecord({
        ...nextIntake,
        termSchedules: nextSchedules,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return summary;
}

export function runIntakeDailyAutomation() {
  return runDailyIntakeChecks(todayDateOnly());
}

export function sanitizeIntakeId(value: unknown) {
  return String(value ?? "").trim();
}

export function sanitizeIntakeStatus(value: unknown): IntakeStatus {
  if (value === "INACTIVE") return "INACTIVE";
  if (value === "DRAFT") return "DRAFT";
  return "ACTIVE";
}

export function sanitizeIntakeName(value: unknown) {
  return collapseSpaces(String(value ?? ""));
}

export function sanitizeTermCode(value: unknown): TermCode {
  const term = String(value ?? "").toUpperCase();
  return TERM_SEQUENCE.find((item) => item === term) ?? "Y1S1";
}

export function sanitizeNotifyBeforeDays(value: unknown): NotifyBeforeDays {
  const parsed = Number(value);
  if (parsed === 1 || parsed === 3 || parsed === 7) {
    return parsed;
  }
  return DEFAULT_NOTIFY_BEFORE_DAYS;
}

export function sanitizeIntakeYear(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.floor(parsed);
}

export function sanitizeIntakeMonth(value: unknown) {
  const input = String(value ?? "").trim().toLowerCase();
  const resolved = MONTHS.find((month) => month.toLowerCase() === input);
  return resolved ?? "";
}

export function sanitizeDateField(value: unknown) {
  const input = String(value ?? "").trim();
  const parsed = asDate(input);
  return parsed ? formatDateOnly(parsed) : "";
}

export function sanitizeToggle(value: unknown) {
  return value === true || value === "true";
}

export function sanitizeTermSchedules(value: unknown): IntakeTermScheduleInput[] {
  if (!Array.isArray(value)) {
    return TERM_SEQUENCE.map((termCode) => ({
      termCode,
      startDate: "",
      endDate: "",
      weeks: DEFAULT_TERM_WEEKS,
      notifyBeforeDays: DEFAULT_NOTIFY_BEFORE_DAYS,
      isManuallyCustomized: false,
      manuallyEdited: false,
    }));
  }

  const normalized = value
    .map((item): IntakeTermScheduleInput | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Partial<IntakeTermScheduleInput>;
      const manuallyEdited =
        row.isManuallyCustomized === true ||
        (item as { manuallyEdited?: boolean }).manuallyEdited === true;
      const startDate = sanitizeDateField(row.startDate);
      const weeks = sanitizeWeeksCount(row.weeks);
      const endDate = startDate
        ? calculateEndDateFromWeeks(startDate, weeks)
        : sanitizeDateField(row.endDate);

      return {
        termCode: sanitizeTermCode(row.termCode),
        startDate,
        endDate,
        weeks,
        notifyBeforeDays: sanitizeNotifyBeforeDays(row.notifyBeforeDays),
        isManuallyCustomized: manuallyEdited,
        manuallyEdited,
      };
    })
    .filter((item): item is IntakeTermScheduleInput => item !== null);

  const byTerm = new Map<TermCode, IntakeTermScheduleInput>();
  normalized.forEach((schedule) => byTerm.set(schedule.termCode, schedule));

  return TERM_SEQUENCE.map((termCode) => {
    const row = byTerm.get(termCode);
    const startDate = row?.startDate ?? "";
    const weeks = sanitizeWeeksCount(row?.weeks);
    return {
      termCode,
      startDate,
      endDate: startDate
        ? calculateEndDateFromWeeks(startDate, weeks)
        : row?.endDate ?? "",
      weeks,
      notifyBeforeDays: row?.notifyBeforeDays ?? DEFAULT_NOTIFY_BEFORE_DAYS,
      isManuallyCustomized: row?.isManuallyCustomized === true,
      manuallyEdited: row?.isManuallyCustomized === true,
    };
  });
}

export function hasInvalidTermScheduleRange(
  schedules: IntakeTermScheduleInput[]
) {
  return schedules.some((schedule) => {
    if (sanitizeWeeksCount(schedule.weeks) <= 0) {
      return true;
    }

    if (!schedule.startDate || !schedule.endDate) {
      return false;
    }

    return compareDateOnly(schedule.endDate, schedule.startDate) < 0;
  });
}

export function getNextTerm(term: TermCode) {
  const index = termIndex(term);
  if (index < 0 || index >= TERM_SEQUENCE.length - 1) {
    return null;
  }

  return TERM_SEQUENCE[index + 1];
}

export function listIntakes(options?: {
  search?: string;
  status?: "" | IntakeStatus;
  sort?: IntakeSort;
  faculty?: string;
  degree?: string;
  currentTerm?: TermCode | "";
}) {
  runDailyIntakeChecks(todayDateOnly());

  const search = options?.search?.trim().toLowerCase() ?? "";
  const status = options?.status ?? "";
  const sort = options?.sort ?? "updated";
  const faculty = normalizeCode(options?.faculty ?? "");
  const degree = normalizeCode(options?.degree ?? "");
  const currentTerm = options?.currentTerm ?? "";

  const filtered = intakeStore().filter((intake) => {
    if (intake.isDeleted) {
      return false;
    }

    if (status && intake.status !== status) {
      return false;
    }

    if (faculty && intake.facultyCode !== faculty) {
      return false;
    }

    if (degree && intake.degreeCode !== degree) {
      return false;
    }

    if (currentTerm && intake.currentTerm !== currentTerm) {
      return false;
    }

    if (!search) {
      return true;
    }

    return `${intake.name} ${intakeLabel(intake)} ${intake.facultyCode} ${intake.degreeCode} ${intake.currentTerm}`
      .toLowerCase()
      .includes(search);
  });

  return filtered.sort((left, right) => {
    if (sort === "az") {
      const yearCompare = left.intakeYear - right.intakeYear;
      if (yearCompare !== 0) {
        return yearCompare;
      }

      const monthCompare = monthOrder(left.intakeMonth) - monthOrder(right.intakeMonth);
      if (monthCompare !== 0) {
        return monthCompare;
      }

      return `${left.facultyCode}${left.degreeCode}`.localeCompare(
        `${right.facultyCode}${right.degreeCode}`
      );
    }

    if (sort === "za") {
      const yearCompare = right.intakeYear - left.intakeYear;
      if (yearCompare !== 0) {
        return yearCompare;
      }

      const monthCompare = monthOrder(right.intakeMonth) - monthOrder(left.intakeMonth);
      if (monthCompare !== 0) {
        return monthCompare;
      }

      return `${right.facultyCode}${right.degreeCode}`.localeCompare(
        `${left.facultyCode}${left.degreeCode}`
      );
    }

    if (sort === "created") {
      return right.createdAt.localeCompare(left.createdAt);
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function findIntakeById(
  id: string,
  options?: {
    includeDeleted?: boolean;
  }
) {
  runDailyIntakeChecks(todayDateOnly());
  const targetId = sanitizeIntakeId(id);

  return (
    intakeStore().find((intake) => {
      if (intake.id !== targetId) {
        return false;
      }

      if (options?.includeDeleted) {
        return true;
      }

      return !intake.isDeleted;
    }) ?? null
  );
}

export function getIntakeTerms(id: string) {
  const intake = findIntakeById(id);
  if (!intake) {
    return null;
  }

  const normalized = normalizeIntakeRecord(intake);
  const policies = resolveIntakePolicies(normalized);

  return {
    intakeId: normalized.id,
    currentTerm: normalized.currentTerm,
    policies,
    schedules: normalized.termSchedules.map((schedule) => ({
      ...schedule,
      manuallyEdited: schedule.isManuallyCustomized,
      isManuallyCustomized: schedule.isManuallyCustomized,
    })),
    updatedAt: normalized.updatedAt,
  };
}

export function updateIntakeTerms(
  id: string,
  input: {
    currentTerm?: TermCode;
    policies?: IntakeTermPoliciesInput;
    schedules?: IntakeTermScheduleInput[];
  }
) {
  const targetId = sanitizeIntakeId(id);
  const store = intakeStore();
  const index = store.findIndex((intake) => intake.id === targetId && !intake.isDeleted);

  if (index < 0) {
    return null;
  }

  const today = todayDateOnly();
  const current = normalizeIntakeRecord(store[index]);
  const currentPolicies = resolveIntakePolicies(current);
  const nextPolicies: IntakeTermPoliciesRecord = {
    autoJump:
      input.policies?.autoJump === undefined
        ? currentPolicies.autoJump
        : sanitizeToggle(input.policies.autoJump),
    lockPastTerms:
      input.policies?.lockPastTerms === undefined
        ? currentPolicies.lockPastTerms
        : sanitizeToggle(input.policies.lockPastTerms),
    defaultWeeksPerTerm:
      input.policies?.defaultWeeksPerTerm === undefined
        ? currentPolicies.defaultWeeksPerTerm
        : sanitizeDefaultWeeksPerTerm(input.policies.defaultWeeksPerTerm),
    defaultNotifyBeforeDays:
      input.policies?.defaultNotifyBeforeDays === undefined
        ? currentPolicies.defaultNotifyBeforeDays
        : sanitizeNotifyBeforeDays(input.policies.defaultNotifyBeforeDays),
    autoGenerateFutureTerms:
      input.policies?.autoGenerateFutureTerms === undefined
        ? currentPolicies.autoGenerateFutureTerms
        : sanitizeToggle(input.policies.autoGenerateFutureTerms),
  };

  const nextCurrentTerm =
    input.currentTerm === undefined
      ? current.currentTerm
      : sanitizeTermCode(input.currentTerm);

  const nextSchedules = Array.isArray(input.schedules)
    ? mergeSchedulesPreservingPast(
        current.termSchedules,
        sanitizeTermSchedules(input.schedules),
        {
          today,
          autoGenerateFutureTerms: nextPolicies.autoGenerateFutureTerms,
          lockPastTerms: nextPolicies.lockPastTerms,
        }
      )
    : current.termSchedules;

  const schedulesWithDefaults = applyPolicyDefaultsToSchedules(nextSchedules, {
    defaultWeeksPerTerm: nextPolicies.defaultWeeksPerTerm,
    defaultNotifyBeforeDays: nextPolicies.defaultNotifyBeforeDays,
  });

  const updatedIntake = normalizeIntakeRecord({
    ...current,
    currentTerm: nextCurrentTerm,
    autoJumpEnabled: nextPolicies.autoJump,
    lockPastTerms: nextPolicies.lockPastTerms,
    defaultWeeksPerTerm: nextPolicies.defaultWeeksPerTerm,
    defaultNotifyBeforeDays: nextPolicies.defaultNotifyBeforeDays,
    autoGenerateFutureTerms: nextPolicies.autoGenerateFutureTerms,
    termSchedules: schedulesWithDefaults,
    updatedAt: new Date().toISOString(),
  });

  store[index] = updatedIntake;
  runDailyIntakeChecks(todayDateOnly());

  return store[index];
}

export function recalculateIntakeFutureTerms(
  id: string,
  options?: {
    overwriteManuallyEditedFuture?: boolean;
  }
) {
  const targetId = sanitizeIntakeId(id);
  const store = intakeStore();
  const index = store.findIndex((intake) => intake.id === targetId && !intake.isDeleted);

  if (index < 0) {
    return null;
  }

  const today = todayDateOnly();
  const current = normalizeIntakeRecord(store[index]);
  const policies = resolveIntakePolicies(current);
  const recalculated = autoGenerateFutureSchedules(current.termSchedules, {
    today,
    force: options?.overwriteManuallyEditedFuture === true,
  });
  const schedulesWithDefaults = applyPolicyDefaultsToSchedules(recalculated, {
    defaultWeeksPerTerm: policies.defaultWeeksPerTerm,
    defaultNotifyBeforeDays: policies.defaultNotifyBeforeDays,
  });

  const updatedIntake = normalizeIntakeRecord({
    ...current,
    termSchedules: schedulesWithDefaults,
    updatedAt: new Date().toISOString(),
  });

  store[index] = updatedIntake;
  runDailyIntakeChecks(todayDateOnly());

  return store[index];
}

export function hasIntakeConflict(input: {
  facultyCode: string;
  degreeCode: string;
  intakeYear?: number;
  intakeMonth?: string;
  name?: string;
  excludeId?: string;
}) {
  const normalizedName = sanitizeIntakeName(input.name);
  const normalizedMonth = sanitizeIntakeMonth(input.intakeMonth);
  const normalizedYear = sanitizeIntakeYear(input.intakeYear);

  return intakeStore().some((intake) => {
    if (intake.isDeleted) {
      return false;
    }

    if (input.excludeId && intake.id === input.excludeId) {
      return false;
    }

    if (intake.facultyCode !== input.facultyCode || intake.degreeCode !== input.degreeCode) {
      return false;
    }

    if (normalizedName) {
      return sanitizeIntakeName(intake.name).toLowerCase() === normalizedName.toLowerCase();
    }

    return (
      intake.intakeYear === normalizedYear &&
      intake.intakeMonth === normalizedMonth
    );
  });
}

function buildIntakeId(input: {
  facultyCode: string;
  degreeCode: string;
  intakeName: string;
}) {
  const baseId = `intk-${input.intakeName}-${input.facultyCode}-${input.degreeCode}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const exists = intakeStore().some((item) => item.id === baseId);
  if (!exists) {
    return baseId;
  }

  return `${baseId}-${Date.now()}`;
}

export function createIntake(input: {
  name?: string;
  facultyCode: string;
  degreeCode: string;
  intakeYear: number;
  intakeMonth: string;
  status: IntakeStatus;
  autoGenerateTerms?: boolean;
  autoGenerateFutureTerms?: boolean;
  recalculateFutureTerms?: boolean;
  autoJumpEnabled?: boolean;
  termSchedules?: IntakeTermScheduleInput[];
  stream?: string;
}) {
  const now = new Date().toISOString();
  const fallbackName = `${input.intakeYear} ${input.intakeMonth}`.trim();
  const intakeName = sanitizeIntakeName(input.name || fallbackName);
  const parsedName = parseIntakeName(intakeName);
  const intakeYear = parsedName.intakeYear || input.intakeYear;
  const intakeMonth = parsedName.intakeMonth || input.intakeMonth;

  const shouldAutoGenerateFutureTerms =
    input.autoGenerateFutureTerms ??
    input.autoGenerateTerms ??
    DEFAULT_AUTO_GENERATE_FUTURE_TERMS;
  const rawSchedules =
    input.termSchedules && input.termSchedules.length > 0
      ? normalizeSchedules(input.termSchedules)
      : TERM_SEQUENCE.map((termCode) => emptyTermSchedule(termCode));
  const defaultWeeksPerTerm = sanitizeDefaultWeeksPerTerm(
    rawSchedules[0]?.weeks ?? DEFAULT_TERM_WEEKS
  );
  const defaultNotifyBeforeDays = sanitizeNotifyBeforeDays(
    rawSchedules[0]?.notifyBeforeDays ?? DEFAULT_NOTIFY_BEFORE_DAYS
  );
  const schedulesWithDefaults = applyPolicyDefaultsToSchedules(rawSchedules, {
    defaultWeeksPerTerm,
    defaultNotifyBeforeDays,
  });

  const termSchedules =
    shouldAutoGenerateFutureTerms
      ? autoGenerateFutureSchedules(schedulesWithDefaults, {
          force: input.recalculateFutureTerms,
          today: todayDateOnly(),
        })
      : schedulesWithDefaults.map((item) => ({
          ...item,
          endDate: item.startDate
            ? calculateEndDateFromWeeks(item.startDate, item.weeks)
            : item.endDate,
        }));

  const nextIntake: IntakeRecord = {
    id: buildIntakeId({
      intakeName,
      facultyCode: normalizeCode(input.facultyCode),
      degreeCode: normalizeCode(input.degreeCode),
    }),
    name: intakeName,
    facultyCode: normalizeCode(input.facultyCode),
    degreeCode: normalizeCode(input.degreeCode),
    intakeYear,
    intakeMonth,
    stream: collapseSpaces(String(input.stream ?? "")) || undefined,
    status: input.status,
    currentTerm: "Y1S1",
    autoJumpEnabled:
      typeof input.autoJumpEnabled === "boolean"
        ? input.autoJumpEnabled
        : DEFAULT_AUTO_JUMP_ENABLED,
    lockPastTerms: DEFAULT_LOCK_PAST_TERMS,
    defaultWeeksPerTerm,
    defaultNotifyBeforeDays,
    autoGenerateFutureTerms: shouldAutoGenerateFutureTerms,
    termSchedules,
    notifications: [],
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };

  intakeStore().unshift(normalizeIntakeRecord(nextIntake));
  runDailyIntakeChecks(todayDateOnly());
  return intakeStore()[0];
}

export function updateIntake(
  id: string,
  input: {
    name?: string;
    facultyCode: string;
    degreeCode: string;
    intakeYear: number;
    intakeMonth: string;
    status: IntakeStatus;
    autoGenerateFutureTerms?: boolean;
    recalculateFutureTerms?: boolean;
    autoJumpEnabled?: boolean;
    termSchedules?: IntakeTermScheduleInput[];
    stream?: string;
  }
) {
  const targetId = sanitizeIntakeId(id);
  const store = intakeStore();
  const index = store.findIndex((intake) => intake.id === targetId && !intake.isDeleted);

  if (index < 0) {
    return null;
  }

  const current = store[index];
  const currentPolicies = resolveIntakePolicies(current);
  const nextAutoGenerateFutureTerms =
    typeof input.autoGenerateFutureTerms === "boolean"
      ? input.autoGenerateFutureTerms
      : currentPolicies.autoGenerateFutureTerms;
  const intakeName = sanitizeIntakeName(input.name || current.name);
  const parsedName = parseIntakeName(intakeName || `${input.intakeYear} ${input.intakeMonth}`);
  const nextIntakeYear = parsedName.intakeYear || input.intakeYear;
  const nextIntakeMonth = parsedName.intakeMonth || input.intakeMonth;

  const mergedSchedules =
    input.termSchedules && input.termSchedules.length > 0
      ? mergeSchedulesPreservingPast(current.termSchedules, input.termSchedules, {
          today: todayDateOnly(),
          autoGenerateFutureTerms: nextAutoGenerateFutureTerms,
          recalculateFutureTerms: input.recalculateFutureTerms,
          lockPastTerms: currentPolicies.lockPastTerms,
        })
      : current.termSchedules;
  const nextSchedules = applyPolicyDefaultsToSchedules(mergedSchedules, {
    defaultWeeksPerTerm: currentPolicies.defaultWeeksPerTerm,
    defaultNotifyBeforeDays: currentPolicies.defaultNotifyBeforeDays,
  });

  const updatedIntake: IntakeRecord = {
    ...current,
    name: intakeName,
    facultyCode: normalizeCode(input.facultyCode),
    degreeCode: normalizeCode(input.degreeCode),
    intakeYear: nextIntakeYear,
    intakeMonth: nextIntakeMonth,
    stream: collapseSpaces(String(input.stream ?? current.stream ?? "")) || undefined,
    status: input.status,
    autoJumpEnabled:
      typeof input.autoJumpEnabled === "boolean"
        ? input.autoJumpEnabled
        : current.autoJumpEnabled,
    lockPastTerms: currentPolicies.lockPastTerms,
    defaultWeeksPerTerm: currentPolicies.defaultWeeksPerTerm,
    defaultNotifyBeforeDays: currentPolicies.defaultNotifyBeforeDays,
    autoGenerateFutureTerms: nextAutoGenerateFutureTerms,
    termSchedules: nextSchedules,
    updatedAt: new Date().toISOString(),
  };

  store[index] = normalizeIntakeRecord(updatedIntake);
  runDailyIntakeChecks(todayDateOnly());
  return store[index];
}

export function updateIntakeSchedule(
  id: string,
  input: {
    currentTerm: TermCode;
    termStartDate: string;
    termEndDate: string;
    autoJumpEnabled: boolean;
  }
) {
  const targetId = sanitizeIntakeId(id);
  const store = intakeStore();
  const index = store.findIndex((intake) => intake.id === targetId && !intake.isDeleted);

  if (index < 0) {
    return null;
  }

  const today = todayDateOnly();
  const existing = store[index];
  const policies = resolveIntakePolicies(existing);
  const schedules = existing.termSchedules.map((schedule) => ({ ...schedule }));
  const scheduleIndex = termIndex(input.currentTerm);

  if (scheduleIndex < 0) {
    return existing;
  }

  const targetSchedule = schedules[scheduleIndex];
  if (policies.lockPastTerms && getTermScheduleStatus(targetSchedule, today) === "PAST") {
    return existing;
  }

  const startDate = sanitizeDateField(input.termStartDate);
  const endDate = sanitizeDateField(input.termEndDate);
  const nextWeeks = startDate && endDate
    ? weeksFromDateRange(startDate, endDate)
    : targetSchedule.weeks;

  schedules[scheduleIndex] = {
    ...targetSchedule,
    startDate,
    weeks: sanitizeWeeksCount(nextWeeks),
    endDate: startDate
      ? calculateEndDateFromWeeks(startDate, sanitizeWeeksCount(nextWeeks))
      : "",
    isManuallyCustomized: true,
    notificationSentAt: "",
  };

  store[index] = normalizeIntakeRecord({
    ...existing,
    currentTerm: input.currentTerm,
    autoJumpEnabled: input.autoJumpEnabled,
    termSchedules: schedules,
    updatedAt: new Date().toISOString(),
  });

  runDailyIntakeChecks(todayDateOnly());
  return store[index];
}

export function promoteIntake(
  id: string,
  options?: {
    notifyStudents?: boolean;
    lockPreviousTerm?: boolean;
  }
) {
  const targetId = sanitizeIntakeId(id);
  const store = intakeStore();
  const index = store.findIndex((intake) => intake.id === targetId && !intake.isDeleted);

  if (index < 0) {
    return null;
  }

  const current = store[index];
  const nextTerm = getNextTerm(current.currentTerm);
  if (!nextTerm) {
    return {
      intake: current,
      nextTerm: null,
    };
  }

  let notifications = current.notifications;
  if (options?.notifyStudents) {
    const nextSchedule =
      current.termSchedules[termIndex(nextTerm)] ?? emptyTermSchedule(nextTerm);
    if (nextSchedule.startDate) {
      notifications = [
        createNotificationRecord(current, nextTerm, nextSchedule.startDate),
        ...notifications,
      ];
    }
  }

  const updatedIntake: IntakeRecord = {
    ...current,
    currentTerm: nextTerm,
    notifications,
    updatedAt: new Date().toISOString(),
  };

  store[index] = normalizeIntakeRecord(updatedIntake);
  return {
    intake: store[index],
    nextTerm,
  };
}

export function deleteIntake(id: string) {
  const targetId = sanitizeIntakeId(id);
  const store = intakeStore();
  const index = store.findIndex((intake) => intake.id === targetId && !intake.isDeleted);

  if (index < 0) {
    return false;
  }

  store[index] = {
    ...store[index],
    isDeleted: true,
    updatedAt: new Date().toISOString(),
  };

  return true;
}

export function isValidFacultyCode(code: string) {
  return Boolean(findFaculty(code));
}

export function isValidDegreeForFaculty(degreeCode: string, facultyCode: string) {
  const normalizedDegree = normalizeCode(degreeCode);
  const normalizedFaculty = normalizeCode(facultyCode);
  const degree = findDegreeProgram(normalizedDegree);
  if (!degree) {
    return false;
  }

  return degree.facultyCode === normalizedFaculty;
}

export function listMonthOptions() {
  return [...MONTHS];
}

export function listTermOptions() {
  return [...TERM_SEQUENCE];
}


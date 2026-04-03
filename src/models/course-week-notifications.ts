import "@/models/Enrollment";
import "@/models/IntakeRecord";
import "@/models/ModuleOffering";
import "@/models/PortalData";
import "@/models/Student";
import "@/models/User";
import { EnrollmentModel } from "@/models/Enrollment";
import { IntakeRecordModel } from "@/models/IntakeRecord";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { PortalDataModel } from "@/models/PortalData";
import { StudentModel } from "@/models/Student";
import { UserModel } from "@/models/User";
import {
  buildTermWeekRanges,
  collapseSpaces,
  hasWeekContentPayload,
  mergeCourseWeeks,
  normalizeCourseOffering,
} from "@/models/course-week-utils";
import {
  isNotificationEmailConfigured,
  sendNotificationEmails,
} from "@/lib/notification-email";

interface IntakeScheduleRecord {
  termCode: string;
  startDate: string;
  endDate: string;
  weeks: number;
}

interface IntakeRecordLite {
  id: string;
  name: string;
  status: string;
  currentTerm: string;
  termSchedules: IntakeScheduleRecord[];
}

interface IntakeStudentRecipientSet {
  userIds: string[];
  emailTargets: string[];
}

export interface CourseWeekNotificationSummary {
  checkedIntakes: number;
  startedWeekIntakes: number;
  checkedOfferings: number;
  notificationsCreated: number;
  skippedDuplicates: number;
  emailSentAddresses: number;
  emailFailedAddresses: number;
}

function readId(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const row = value as { _id?: unknown; id?: unknown; toString?: () => string };
    const nested = String(row._id ?? row.id ?? "").trim();
    if (nested) {
      return nested;
    }
    const rendered = typeof row.toString === "function" ? row.toString() : "";
    return rendered === "[object Object]" ? "" : rendered.trim();
  }
  return "";
}

function normalizeEmail(value: unknown) {
  return collapseSpaces(value).toLowerCase();
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function parseIntakeLite(value: unknown): IntakeRecordLite | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = collapseSpaces(row.id);
  const name = collapseSpaces(row.name);
  const currentTerm = collapseSpaces(row.currentTerm).toUpperCase();
  const status = collapseSpaces(row.status).toUpperCase();
  if (!id || !name || !currentTerm) {
    return null;
  }

  const termSchedules = Array.isArray(row.termSchedules)
    ? row.termSchedules
        .map((item) => {
          const schedule = asObject(item);
          if (!schedule) {
            return null;
          }
          const termCode = collapseSpaces(schedule.termCode).toUpperCase();
          const startDate = collapseSpaces(schedule.startDate);
          const endDate = collapseSpaces(schedule.endDate);
          const weeks = Math.max(
            1,
            Math.min(60, Math.floor(Number(schedule.weeks) || 1))
          );
          if (!termCode || !startDate) {
            return null;
          }
          return {
            termCode,
            startDate,
            endDate,
            weeks,
          } satisfies IntakeScheduleRecord;
        })
        .filter((item): item is IntakeScheduleRecord => Boolean(item))
    : [];

  return {
    id,
    name,
    status,
    currentTerm,
    termSchedules,
  };
}

function parseNotificationFeed(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<Record<string, unknown>>;
  }

  return value
    .map((item) => asObject(item))
    .filter((item): item is Record<string, unknown> => Boolean(item));
}

function readWeekStartForCurrentTerm(intake: IntakeRecordLite, today: string) {
  const schedule =
    intake.termSchedules.find((item) => item.termCode === intake.currentTerm) ?? null;
  if (!schedule) {
    return null;
  }

  const weeks = buildTermWeekRanges({
    startDate: schedule.startDate,
    endDate: schedule.endDate,
    weeks: schedule.weeks,
    today,
  });
  const currentWeek = weeks.find((item) => item.isCurrent) ?? null;
  if (!currentWeek || currentWeek.startDate !== today) {
    return null;
  }

  return {
    currentWeek,
    weekRanges: weeks,
    termCode: intake.currentTerm,
  };
}

async function resolveIntakeStudentRecipients(intakeId: string) {
  const enrollmentRows = (await EnrollmentModel.find({
    intakeId,
    status: "ACTIVE",
  })
    .select({ studentId: 1 })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const studentRefIds = Array.from(
    new Set(
      enrollmentRows
        .map((row) => readId(asObject(row)?.studentId))
        .filter(Boolean)
    )
  );
  if (studentRefIds.length === 0) {
    return {
      userIds: [],
      emailTargets: [],
    } satisfies IntakeStudentRecipientSet;
  }

  const [userRows, studentRows] = await Promise.all([
    UserModel.find({
      role: "STUDENT",
      status: "ACTIVE",
      studentRef: { $in: studentRefIds },
    })
      .select({ _id: 1, email: 1, studentRef: 1 })
      .lean()
      .exec()
      .catch(() => []),
    StudentModel.find({
      _id: { $in: studentRefIds },
      status: "ACTIVE",
    })
      .select({ _id: 1, email: 1, optionalEmail: 1 })
      .lean()
      .exec()
      .catch(() => []),
  ]);

  const studentEmailById = new Map<string, string[]>();
  (studentRows as unknown[])
    .map((row) => asObject(row))
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .forEach((row) => {
      const studentId = readId(row._id);
      if (!studentId) {
        return;
      }
      const emailList = Array.from(
        new Set(
          [normalizeEmail(row.email), normalizeEmail(row.optionalEmail)].filter(Boolean)
        )
      );
      studentEmailById.set(studentId, emailList);
    });

  const userIds: string[] = [];
  const emailTargets = new Set<string>();
  (userRows as unknown[])
    .map((row) => asObject(row))
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .forEach((row) => {
      const userId = readId(row._id);
      const studentRef = readId(row.studentRef);
      if (!userId || !studentRef) {
        return;
      }
      userIds.push(userId);
      const primaryUserEmail = normalizeEmail(row.email);
      if (primaryUserEmail) {
        emailTargets.add(primaryUserEmail);
      }
      (studentEmailById.get(studentRef) ?? []).forEach((email) => {
        emailTargets.add(email);
      });
    });

  return {
    userIds: Array.from(new Set(userIds)),
    emailTargets: Array.from(emailTargets),
  } satisfies IntakeStudentRecipientSet;
}

function buildNotificationMessage(input: {
  moduleCode: string;
  moduleName: string;
  weekNo: number;
  startDate: string;
  endDate: string;
  lectureSlidesCount: number;
  resourcesCount: number;
  assignmentsCount: number;
  todoCount: number;
}) {
  return (
    `Week ${input.weekNo} is now active for ${input.moduleCode} ${input.moduleName} ` +
    `(${input.startDate} to ${input.endDate}). ` +
    `Slides: ${input.lectureSlidesCount}, resources: ${input.resourcesCount}, ` +
    `assignments: ${input.assignmentsCount}, todo: ${input.todoCount}.`
  );
}

function buildNotificationHtml(input: {
  title: string;
  message: string;
  intakeName: string;
  termCode: string;
}) {
  const escapedTitle = input.title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const escapedMessage = input.message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const escapedIntake = input.intakeName
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const escapedTerm = input.termCode
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1a1a1a;">
      <h2 style="margin: 0 0 12px;">${escapedTitle}</h2>
      <p style="margin: 0 0 12px;">${escapedMessage}</p>
      <p style="margin: 0; font-size: 12px; color: #555;">
        Intake: ${escapedIntake}<br />
        Semester: ${escapedTerm}
      </p>
    </div>
  `.trim();
}

export async function runCourseWeekNotificationJob(options?: { today?: string }) {
  const today = collapseSpaces(options?.today) || todayDateOnly();
  const nowIso = new Date().toISOString();
  const summary: CourseWeekNotificationSummary = {
    checkedIntakes: 0,
    startedWeekIntakes: 0,
    checkedOfferings: 0,
    notificationsCreated: 0,
    skippedDuplicates: 0,
    emailSentAddresses: 0,
    emailFailedAddresses: 0,
  };

  const intakeRows = (await IntakeRecordModel.find({
    isDeleted: { $ne: true },
    status: "ACTIVE",
  })
    .select({ id: 1, name: 1, status: 1, currentTerm: 1, termSchedules: 1 })
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const intakes = intakeRows
    .map((row) => parseIntakeLite(row))
    .filter((row): row is IntakeRecordLite => Boolean(row));
  summary.checkedIntakes = intakes.length;

  const feedRow = await PortalDataModel.findOne({ key: "notification-feed" })
    .lean()
    .exec()
    .catch(() => null);
  const existingFeed = parseNotificationFeed(asObject(feedRow)?.value);
  const existingIds = new Set(
    existingFeed.map((item) => collapseSpaces(item.id)).filter(Boolean)
  );
  const generatedFeedItems: Array<Record<string, unknown>> = [];

  const recipientCache = new Map<string, IntakeStudentRecipientSet>();
  const emailEnabled = isNotificationEmailConfigured();

  for (const intake of intakes) {
    const weekStartMeta = readWeekStartForCurrentTerm(intake, today);
    if (!weekStartMeta) {
      continue;
    }
    summary.startedWeekIntakes += 1;

    let recipients = recipientCache.get(intake.id);
    if (!recipients) {
      recipients = await resolveIntakeStudentRecipients(intake.id);
      recipientCache.set(intake.id, recipients);
    }

    if (recipients.userIds.length === 0) {
      continue;
    }

    const offeringRows = (await ModuleOfferingModel.find({
      status: "ACTIVE",
      termCode: weekStartMeta.termCode,
      $or: [{ intakeId: intake.id }, { intakeName: intake.name }],
    })
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    for (const offeringRow of offeringRows) {
      const offering = normalizeCourseOffering(offeringRow);
      if (!offering || offering.status !== "ACTIVE") {
        continue;
      }
      summary.checkedOfferings += 1;

      const weeks = mergeCourseWeeks({
        weekRanges: weekStartMeta.weekRanges,
        outlineByWeek: offering.outlineByWeek,
        weekContentsByWeek: offering.weekContentsByWeek,
        today,
      });
      const week = weeks.find(
        (item) => item.weekNo === weekStartMeta.currentWeek.weekNo
      );
      if (!week) {
        continue;
      }

      const normalizedOutline = collapseSpaces(week.outline).toLowerCase();
      const hasMeaningfulOutline =
        Boolean(normalizedOutline) &&
        normalizedOutline !== `week ${week.weekNo}`.toLowerCase();
      const hasContent =
        hasMeaningfulOutline ||
        hasWeekContentPayload({
          weekNo: week.weekNo,
          outline: "",
          lectureSlides: week.lectureSlides,
          resources: week.resources,
          assignments: week.assignments,
          todoItems: week.todoItems,
          updatedAt: week.updatedAt,
        });
      if (!hasContent) {
        continue;
      }

      const notificationId = [
        "course-week",
        offering.id,
        week.weekNo,
        week.startDate || today,
      ].join("-");
      if (existingIds.has(notificationId)) {
        summary.skippedDuplicates += 1;
        continue;
      }
      existingIds.add(notificationId);

      const title = `${offering.moduleCode} - Week ${week.weekNo} started`;
      const message = buildNotificationMessage({
        moduleCode: offering.moduleCode,
        moduleName: offering.moduleName,
        weekNo: week.weekNo,
        startDate: week.startDate || today,
        endDate: week.endDate || today,
        lectureSlidesCount: week.lectureSlides.length,
        resourcesCount: week.resources.length,
        assignmentsCount: week.assignments.length,
        todoCount: week.todoItems.length,
      });

      generatedFeedItems.push({
        id: notificationId,
        type: "System",
        title,
        message,
        publishedAt: nowIso,
        time: "Just now",
        unread: true,
        targetLabel: `${offering.intakeName} ${offering.termCode}`,
        audience: {
          roles: ["STUDENT"],
          facultyCodes: offering.facultyCode ? [offering.facultyCode] : [],
          degreeCodes: offering.degreeCode ? [offering.degreeCode] : [],
          semesterCodes: [offering.termCode],
          intakeIds: [intake.id],
        },
        channel: emailEnabled ? "Both" : "In-app",
        recipientUserIds: recipients.userIds,
        recipientCount: recipients.userIds.length,
      });
      summary.notificationsCreated += 1;

      if (emailEnabled && recipients.emailTargets.length > 0) {
        const emailResult = await sendNotificationEmails({
          subject: `[Campus Support Desk] ${title}`,
          text: `${message}\n\nIntake: ${intake.name}\nSemester: ${offering.termCode}`,
          html: buildNotificationHtml({
            title,
            message,
            intakeName: intake.name,
            termCode: offering.termCode,
          }),
          recipients: recipients.emailTargets,
        }).catch(() => ({
          sentAddresses: 0,
          failedAddresses: recipients.emailTargets.length,
          failedEmailList: recipients.emailTargets,
        }));

        summary.emailSentAddresses += emailResult.sentAddresses;
        summary.emailFailedAddresses += emailResult.failedAddresses;
      }
    }
  }

  if (generatedFeedItems.length > 0) {
    const nextFeed = [...generatedFeedItems, ...existingFeed].slice(0, 2000);
    await PortalDataModel.findOneAndUpdate(
      { key: "notification-feed" },
      {
        $set: {
          key: "notification-feed",
          value: nextFeed,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
      .lean()
      .exec()
      .catch(() => null);
  }

  return summary;
}

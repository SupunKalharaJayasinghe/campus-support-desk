import "@/models/IntakeRecord";
import { IntakeRecordModel } from "@/models/IntakeRecord";
import { syncAcademicReferenceCaches } from "@/models/academic-reference-cache";
import type { IntakeRecord } from "@/models/intake-store";

export function toDbIntakePayload(intake: IntakeRecord) {
  return {
    id: intake.id,
    name: intake.name,
    facultyCode: intake.facultyCode,
    degreeCode: intake.degreeCode,
    intakeYear: intake.intakeYear,
    intakeMonth: intake.intakeMonth,
    stream: intake.stream ?? "",
    status: intake.status,
    currentTerm: intake.currentTerm,
    autoJumpEnabled: intake.autoJumpEnabled !== false,
    lockPastTerms: intake.lockPastTerms !== false,
    defaultWeeksPerTerm: intake.defaultWeeksPerTerm,
    defaultNotifyBeforeDays: intake.defaultNotifyBeforeDays,
    autoGenerateFutureTerms: intake.autoGenerateFutureTerms !== false,
    termSchedules: intake.termSchedules.map((schedule) => ({
      termCode: schedule.termCode,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      weeks: schedule.weeks,
      notifyBeforeDays: schedule.notifyBeforeDays,
      isManuallyCustomized: schedule.isManuallyCustomized,
      notificationSentAt: schedule.notificationSentAt,
    })),
    notifications: intake.notifications.map((notification) => ({
      id: notification.id,
      termCode: notification.termCode,
      title: notification.title,
      message: notification.message,
      sentAt: notification.sentAt,
      target: notification.target,
    })),
    isDeleted: intake.isDeleted === true,
  };
}

export async function persistIntakeRecords(intakes: IntakeRecord[]) {
  const uniqueById = new Map<string, IntakeRecord>();
  intakes.forEach((intake) => {
    if (intake?.id) {
      uniqueById.set(intake.id, intake);
    }
  });

  const rows = Array.from(uniqueById.values());
  if (rows.length > 0) {
    await IntakeRecordModel.bulkWrite(
      rows.map((intake) => ({
        updateOne: {
          filter: { id: intake.id },
          update: { $set: toDbIntakePayload(intake) },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  }

  await syncAcademicReferenceCaches({ force: true });
}

export const CONSULTATION_NOTIFICATION_TYPES = [
  "DAY_BEFORE_REMINDER",
  "STARTING_SOON_REMINDER",
] as const;

export type ConsultationNotificationType =
  (typeof CONSULTATION_NOTIFICATION_TYPES)[number];

export const CONSULTATION_NOTIFICATION_RECIPIENT_ROLES = [
  "STUDENT",
  "LECTURER",
] as const;

export type ConsultationNotificationRecipientRole =
  (typeof CONSULTATION_NOTIFICATION_RECIPIENT_ROLES)[number];

export function getConsultationNotificationTypeLabel(
  type: ConsultationNotificationType
) {
  if (type === "STARTING_SOON_REMINDER") {
    return "Starting Soon";
  }

  return "Reminder";
}

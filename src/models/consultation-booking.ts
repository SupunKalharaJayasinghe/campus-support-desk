export const CONSULTATION_BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ConsultationBookingStatus =
  (typeof CONSULTATION_BOOKING_STATUSES)[number];

export function getConsultationBookingStatusLabel(
  status: ConsultationBookingStatus
) {
  if (status === "PENDING") {
    return "Pending";
  }
  if (status === "CONFIRMED") {
    return "Confirmed";
  }
  if (status === "COMPLETED") {
    return "Completed";
  }
  return "Cancelled";
}

export function getConsultationBookingBadgeVariant(
  status: ConsultationBookingStatus
) {
  if (status === "CONFIRMED") {
    return "success" as const;
  }
  if (status === "COMPLETED") {
    return "neutral" as const;
  }
  if (status === "CANCELLED") {
    return "danger" as const;
  }
  return "warning" as const;
}

export function canCancelConsultationBooking(
  status: ConsultationBookingStatus
) {
  return status === "PENDING" || status === "CONFIRMED";
}

export function isActiveConsultationBookingStatus(
  status: ConsultationBookingStatus
) {
  return status !== "CANCELLED";
}

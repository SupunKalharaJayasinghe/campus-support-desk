export const CONSULTATION_SLOT_MODES = [
  "IN_PERSON",
  "ONLINE",
  "HYBRID",
] as const;

export type ConsultationSlotMode = (typeof CONSULTATION_SLOT_MODES)[number];

export const CONSULTATION_SLOT_STATUSES = [
  "AVAILABLE",
  "BOOKED",
  "CANCELLED",
] as const;

export type ConsultationSlotStatus = (typeof CONSULTATION_SLOT_STATUSES)[number];

export function getConsultationSlotModeLabel(mode: ConsultationSlotMode) {
  if (mode === "IN_PERSON") {
    return "In-Person";
  }
  if (mode === "ONLINE") {
    return "Online";
  }
  return "Hybrid";
}

export function getConsultationSlotStatusLabel(status: ConsultationSlotStatus) {
  if (status === "AVAILABLE") {
    return "Available";
  }
  if (status === "BOOKED") {
    return "Booked";
  }
  return "Cancelled";
}

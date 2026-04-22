/** Aligns with student support ticket categories and technician specialization. */
export const TICKET_CATEGORY_OPTIONS = [
  "Academic",
  "Technical",
  "Facility",
  "Finance",
  "Transport",
  "Other",
] as const;

export type TicketCategoryOption = (typeof TICKET_CATEGORY_OPTIONS)[number];

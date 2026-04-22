import type { Types } from "mongoose";

export const SUPPORT_TICKET_PRIORITIES = ["Low", "Medium", "High"] as const;
export const SUPPORT_TICKET_STATUSES = [
  "Open",
  "In progress",
  "Accepted",
  "Resolved",
  "Withdrawn",
] as const;

export type SupportTicketPriority = (typeof SUPPORT_TICKET_PRIORITIES)[number];
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

/**
 * Case-insensitive match on `status` for MongoDB queries.
 * Uses `$expr` so Mongoose does not try to cast a `RegExp` onto the string `enum` field (which
 * caused 500 errors).
 */
export function matchSupportTicketStatusCaseInsensitive(status: SupportTicketStatus) {
  return {
    $expr: {
      $eq: [{ $toLower: { $ifNull: ["$status", ""] } }, status.toLowerCase()],
    },
  };
}

/** Map DB / legacy casing to the canonical enum string. */
export function normalizeSupportTicketStatus(raw: unknown): SupportTicketStatus {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) {
    return s as SupportTicketStatus;
  }
  const lower = s.toLowerCase();
  for (const opt of SUPPORT_TICKET_STATUSES) {
    if (opt.toLowerCase() === lower) {
      return opt;
    }
  }
  return s as SupportTicketStatus;
}

export interface ISupportTicketEvidence {
  fileName: string;
  mimeType: string;
  /** Base64-encoded file bytes (no data-URL prefix). */
  data: string;
}

export interface ISupportTicket {
  studentId: Types.ObjectId;
  subject: string;
  category: string;
  subcategory: string;
  description: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  evidence?: ISupportTicketEvidence[];
  /** Set when an admin assigns a technician from the User collection (role TECHNICIAN). */
  assignedTechnicianId?: Types.ObjectId;
  technicianComments?: string;
  technicianEvidence?: ISupportTicketEvidence[];
  withdrawalReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

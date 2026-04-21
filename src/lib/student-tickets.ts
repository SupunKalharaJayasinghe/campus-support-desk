export type StudentTicketPriority = "Low" | "Medium" | "High" | "Urgent";

export type StudentTicketStatus = "Open" | "In progress" | "Resolved";

/** Base64 payload (no data-URL prefix), matches Mongo subdocuments. */
export type TicketEvidence = {
  fileName: string;
  mimeType: string;
  data: string;
};

export interface StudentTicket {
  id: string;
  subject: string;
  category: string;
  subcategory?: string;
  description: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
  priority: StudentTicketPriority;
  status: StudentTicketStatus;
  createdAt: string;
  evidence?: TicketEvidence[];
}

const STORAGE_PREFIX = "unihub_student_tickets";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}_${userId}`;
}

function safeParse(raw: string | null): StudentTicket[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (row): row is StudentTicket =>
        typeof row === "object" &&
        row !== null &&
        typeof (row as StudentTicket).id === "string" &&
        typeof (row as StudentTicket).subject === "string"
    );
  } catch {
    return [];
  }
}

export function listStudentTickets(userId: string): StudentTicket[] {
  if (typeof window === "undefined" || !userId) {
    return [];
  }
  const items = safeParse(window.localStorage.getItem(storageKey(userId)));
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function saveStudentTickets(userId: string, tickets: StudentTicket[]) {
  if (typeof window === "undefined" || !userId) {
    return;
  }
  window.localStorage.setItem(storageKey(userId), JSON.stringify(tickets));
}

export function addStudentTicket(
  userId: string,
  input: Omit<StudentTicket, "id" | "status" | "createdAt">
): StudentTicket {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `tk_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const ticket: StudentTicket = {
    ...input,
    id,
    status: "Open",
    createdAt: new Date().toISOString(),
  };
  const next = [ticket, ...listStudentTickets(userId)];
  saveStudentTickets(userId, next);
  return ticket;
}

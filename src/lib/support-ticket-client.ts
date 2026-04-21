import { authHeaders, readStoredUser } from "@/lib/rbac";
import {
  addStudentTicket,
  listStudentTickets,
  type StudentTicket,
  type StudentTicketPriority,
  type TicketEvidence,
} from "@/lib/student-tickets";

export type { StudentTicket, StudentTicketPriority, TicketEvidence };

type ListPayload = {
  items: StudentTicket[];
  total?: number;
};

function readErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "Request failed";
  }
  const message = (payload as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message : "Request failed";
}

function parseTicketPayload(value: unknown): StudentTicket | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const subject = typeof row.subject === "string" ? row.subject.trim() : "";
  const category = typeof row.category === "string" ? row.category.trim() : "";
  const subcategory = typeof row.subcategory === "string" ? row.subcategory.trim() : "";
  const description = typeof row.description === "string" ? row.description.trim() : "";
  const priority = row.priority;
  const status = row.status;
  const contactEmail =
    typeof row.contactEmail === "string" && row.contactEmail.trim() ? row.contactEmail.trim() : undefined;
  const contactPhone =
    typeof row.contactPhone === "string" && row.contactPhone.trim() ? row.contactPhone.trim() : undefined;
  const contactWhatsapp =
    typeof row.contactWhatsapp === "string" && row.contactWhatsapp.trim()
      ? row.contactWhatsapp.trim()
      : undefined;
  const createdAt = typeof row.createdAt === "string" ? row.createdAt : "";
  if (
    !id ||
    !subject ||
    !category ||
    !description ||
    !createdAt ||
    (priority !== "Low" && priority !== "Medium" && priority !== "High") ||
    (status !== "Open" && status !== "In progress" && status !== "Resolved")
  ) {
    return null;
  }
  const evidence = parseEvidenceField(row.evidence);
  return {
    id,
    subject,
    category,
    ...(subcategory ? { subcategory } : {}),
    description,
    priority,
    status,
    createdAt,
    ...(contactEmail ? { contactEmail } : {}),
    ...(contactPhone ? { contactPhone } : {}),
    ...(contactWhatsapp ? { contactWhatsapp } : {}),
    ...(evidence?.length ? { evidence } : {}),
  };
}

function parseEvidenceField(raw: unknown): TicketEvidence[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) {
    return undefined;
  }
  const out: TicketEvidence[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const o = item as Record<string, unknown>;
    if (
      typeof o.fileName !== "string" ||
      typeof o.mimeType !== "string" ||
      typeof o.data !== "string"
    ) {
      continue;
    }
    out.push({
      fileName: o.fileName,
      mimeType: o.mimeType,
      data: o.data,
    });
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Loads tickets from the API when MongoDB is available; falls back to browser storage when the API returns 503.
 */
export async function loadStudentTickets(): Promise<StudentTicket[]> {
  const user = readStoredUser();
  const localFallback = () => (user?.id ? listStudentTickets(user.id) : []);

  const response = await fetch("/api/support-tickets", {
    headers: { ...authHeaders() },
  });

  if (response.status === 503) {
    return localFallback();
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  const listPayload = payload as ListPayload;
  const rawItems = Array.isArray(listPayload.items) ? listPayload.items : [];
  return rawItems
    .map((item) => parseTicketPayload(item))
    .filter((item): item is StudentTicket => Boolean(item));
}

type CreateInput = Omit<StudentTicket, "id" | "status" | "createdAt">;

/**
 * Persists a ticket via API when the database is reachable; otherwise falls back to local storage (same as earlier behavior).
 */
export async function createStudentTicketRemote(input: CreateInput): Promise<StudentTicket> {
  const user = readStoredUser();
  const localFallback = () => {
    if (!user?.id) {
      throw new Error("You need to be signed in to create a ticket.");
    }
    return addStudentTicket(user.id, input);
  };

  const response = await fetch("/api/support-tickets", {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (response.status === 503) {
    return localFallback();
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  const parsed = parseTicketPayload(payload);
  if (parsed) {
    return parsed;
  }

  return localFallback();
}

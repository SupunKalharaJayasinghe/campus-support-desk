import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/SupportTicket";
import { connectMongoose } from "@/models/mongoose";
import {
  SUPPORT_TICKET_PRIORITIES,
  SupportTicketModel,
  normalizeSupportTicketStatus,
  type SupportTicketPriority,
  type ISupportTicketEvidence,
} from "@/models/SupportTicket";
import { resolveCurrentStudentId } from "@/app/api/consultation-bookings/shared";

const ALLOWED_CATEGORIES = new Set([
  "Finance",
  "Facility",
  "Transport",
  "Technical",
  "Academic",
  "Other",
]);
const SUBCATEGORY_OPTIONS: Record<string, string[]> = {
  Academic: ["Exams", "Assignments", "Lectures", "Attendance", "Other"],
  Technical: ["Portal login", "LMS issue", "Wi-Fi", "Lab system", "Other"],
  Facility: ["Classroom", "Library", "Laboratory", "Campus maintenance", "Other"],
  Finance: ["Fees", "Scholarship", "Refund", "Payment issue", "Other"],
  Transport: ["Bus pass", "Route issue", "Timing issue", "Driver complaint", "Other"],
  Other: ["General inquiry", "Complaint", "Suggestion"],
};
const MAX_EVIDENCE_FILES = 5;
const MAX_EVIDENCE_DATA_CHARS = 750_000;

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone10(value: string) {
  return /^\d{10}$/.test(value);
}

function sanitizePriority(value: unknown): SupportTicketPriority | null {
  const raw = collapseSpaces(value);
  return SUPPORT_TICKET_PRIORITIES.includes(raw as SupportTicketPriority)
    ? (raw as SupportTicketPriority)
    : null;
}

function isAllowedEvidenceMime(mime: string) {
  const m = mime.toLowerCase().trim();
  if (!m) {
    return false;
  }
  if (m === "application/pdf") {
    return true;
  }
  return m.startsWith("image/");
}

function sanitizeEvidence(raw: unknown):
  | { ok: true; value: ISupportTicketEvidence[] }
  | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, message: "evidence must be an array" };
  }
  if (raw.length > MAX_EVIDENCE_FILES) {
    return { ok: false, message: `At most ${MAX_EVIDENCE_FILES} evidence files are allowed` };
  }
  const out: ISupportTicketEvidence[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, message: "Invalid evidence item" };
    }
    const row = item as Record<string, unknown>;
    const fileName = collapseSpaces(row.fileName).slice(0, 255);
    const mimeType = collapseSpaces(row.mimeType).slice(0, 120);
    const data = typeof row.data === "string" ? row.data.trim() : "";
    if (!fileName || !mimeType || !data) {
      return { ok: false, message: "Each evidence file needs fileName, mimeType, and data" };
    }
    if (!isAllowedEvidenceMime(mimeType)) {
      return { ok: false, message: "Evidence must be images or PDF files" };
    }
    if (data.length > MAX_EVIDENCE_DATA_CHARS) {
      return { ok: false, message: "Each evidence file is too large" };
    }
    if (!/^[A-Za-z0-9+/=\s]+$/.test(data)) {
      return { ok: false, message: "Invalid evidence encoding" };
    }
    out.push({ fileName, mimeType, data: data.replace(/\s+/g, "") });
  }
  return { ok: true, value: out };
}

function canStudentEdit(status: string) {
  const normalized = normalizeSupportTicketStatus(status);
  return normalized === "Open" || normalized === "In progress";
}

type PatchBody = {
  action?: unknown;
  subject?: unknown;
  category?: unknown;
  subcategory?: unknown;
  description?: unknown;
  contactEmail?: unknown;
  contactPhone?: unknown;
  contactWhatsapp?: unknown;
  priority?: unknown;
  withdrawalReason?: unknown;
  evidence?: unknown;
};

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json({ message: "Database connection is required" }, { status: 503 });
  }

  const studentId = await resolveCurrentStudentId(request, mongooseConnection);
  if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = context.params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ticket id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const ticket = await SupportTicketModel.findOne({
    _id: new mongoose.Types.ObjectId(id),
    studentId: new mongoose.Types.ObjectId(studentId),
  })
    .exec()
    .catch(() => null);
  if (!ticket) {
    return NextResponse.json({ message: "Ticket not found" }, { status: 404 });
  }
  if (!canStudentEdit(ticket.status)) {
    return NextResponse.json(
      { message: 'Only tickets in "Open" or "In progress" can be changed by students.' },
      { status: 400 }
    );
  }

  const action = collapseSpaces(body.action).toLowerCase();
  if (action === "withdraw") {
    const reason = collapseSpaces(body.withdrawalReason);
    if (!reason) {
      return NextResponse.json({ message: "Withdrawal reason is required." }, { status: 400 });
    }
    ticket.status = "Withdrawn";
    ticket.withdrawalReason = reason.slice(0, 500);
    await ticket.save();
    return NextResponse.json({ ok: true, id: String(ticket._id), status: ticket.status });
  }

  const subject = collapseSpaces(body.subject);
  const description = collapseSpaces(body.description);
  const category = collapseSpaces(body.category);
  const subcategory = collapseSpaces(body.subcategory);
  const contactEmail = collapseSpaces(body.contactEmail);
  const contactPhone = collapseSpaces(body.contactPhone);
  const contactWhatsapp = collapseSpaces(body.contactWhatsapp);
  const priority = sanitizePriority(body.priority);
  const evidenceParsed = sanitizeEvidence(body.evidence);
  if (!evidenceParsed.ok) {
    return NextResponse.json({ message: evidenceParsed.message }, { status: 400 });
  }

  if (!subject || !description) {
    return NextResponse.json({ message: "Subject and description are required" }, { status: 400 });
  }
  if (!ALLOWED_CATEGORIES.has(category)) {
    return NextResponse.json({ message: "Invalid category" }, { status: 400 });
  }
  const allowedSubcategories = SUBCATEGORY_OPTIONS[category] ?? [];
  if (!subcategory || !allowedSubcategories.includes(subcategory)) {
    return NextResponse.json({ message: "Invalid subcategory" }, { status: 400 });
  }
  if (!priority) {
    return NextResponse.json(
      { message: "Priority must be Low, Medium, or High" },
      { status: 400 }
    );
  }
  const hasAnyContact = Boolean(contactEmail || contactPhone || contactWhatsapp);
  if (!hasAnyContact) {
    return NextResponse.json(
      { message: "At least one contact method is required" },
      { status: 400 }
    );
  }
  if (contactEmail && !isValidEmail(contactEmail)) {
    return NextResponse.json({ message: "Invalid email format" }, { status: 400 });
  }
  if (contactPhone && !isValidPhone10(contactPhone)) {
    return NextResponse.json({ message: "Phone must have 10 digits" }, { status: 400 });
  }
  if (contactWhatsapp && !isValidPhone10(contactWhatsapp)) {
    return NextResponse.json({ message: "WhatsApp must have 10 digits" }, { status: 400 });
  }

  ticket.subject = subject;
  ticket.description = description;
  ticket.category = category;
  ticket.subcategory = subcategory;
  ticket.priority = priority;
  ticket.contactEmail = contactEmail || undefined;
  ticket.contactPhone = contactPhone || undefined;
  ticket.contactWhatsapp = contactWhatsapp || undefined;
  ticket.evidence = evidenceParsed.value;
  await ticket.save();

  return NextResponse.json({ ok: true, id: String(ticket._id), status: ticket.status });
}

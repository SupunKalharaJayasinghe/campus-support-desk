import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/SupportTicket";
import "@/models/User";
import { connectMongoose } from "@/models/mongoose";
import {
  SupportTicketModel,
  normalizeSupportTicketStatus,
  type ISupportTicketEvidence,
} from "@/models/SupportTicket";
import { UserModel } from "@/models/User";
import { toAppRoleFromUserRole } from "@/models/rbac";

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

const MAX_EVIDENCE_FILES = 5;
const MAX_EVIDENCE_DATA_CHARS = 750_000;

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

function sanitizeTechnicianEvidence(
  raw: unknown
): { ok: true; value: ISupportTicketEvidence[] } | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, message: "technicianEvidence must be an array" };
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

async function authorizeAdmin(request: Request) {
  const headerUserId = collapseSpaces(request.headers.get("x-user-id"));
  if (!headerUserId || !mongoose.Types.ObjectId.isValid(headerUserId)) {
    return null;
  }

  const row = (await UserModel.findById(headerUserId)
    .select({ _id: 1, role: 1, status: 1 })
    .lean()
    .exec()
    .catch(() => null)) as Record<string, unknown> | null;

  if (!row || String(row.status ?? "").trim().toUpperCase() !== "ACTIVE") {
    return null;
  }

  const appRole = toAppRoleFromUserRole(row.role);
  if (appRole !== "SUPER_ADMIN") {
    return null;
  }

  return { id: collapseSpaces(row._id) };
}

function sanitizeComments(value: unknown): string {
  const raw = collapseSpaces(value);
  if (!raw) {
    return "";
  }
  return raw.slice(0, 10000);
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const authorized = await authorizeAdmin(request);
  if (!authorized) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = context.params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ticket id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const technicianIdRaw = collapseSpaces(
    body.technicianId ?? body.assignedTechnicianId
  );
  if (!technicianIdRaw || !mongoose.Types.ObjectId.isValid(technicianIdRaw)) {
    return NextResponse.json(
      { message: "A valid technicianId is required" },
      { status: 400 }
    );
  }

  const technicianDoc = (await UserModel.findById(technicianIdRaw)
    .select({ _id: 1, role: 1, status: 1 })
    .lean()
    .exec()
    .catch(() => null)) as Record<string, unknown> | null;

  if (!technicianDoc) {
    return NextResponse.json({ message: "Technician not found" }, { status: 404 });
  }

  const role = String(technicianDoc.role ?? "").trim().toUpperCase();
  if (role !== "TECHNICIAN" && role !== "TECHNISIAN") {
    return NextResponse.json({ message: "User is not a technician" }, { status: 400 });
  }
  if (String(technicianDoc.status ?? "").trim().toUpperCase() !== "ACTIVE") {
    return NextResponse.json(
      { message: "Technician account is not active" },
      { status: 400 }
    );
  }

  const technicianComments = sanitizeComments(body.technicianComments);
  const ev = sanitizeTechnicianEvidence(body.technicianEvidence);
  if (!ev.ok) {
    return NextResponse.json({ message: ev.message }, { status: 400 });
  }

  const ticket = await SupportTicketModel.findById(id).exec().catch(() => null);
  if (!ticket) {
    return NextResponse.json({ message: "Ticket not found" }, { status: 404 });
  }

  if (normalizeSupportTicketStatus(ticket.status) !== "Open") {
    return NextResponse.json(
      { message: "Only open tickets can be assigned to a technician" },
      { status: 400 }
    );
  }

  ticket.assignedTechnicianId = new mongoose.Types.ObjectId(technicianIdRaw);
  ticket.technicianComments = technicianComments || undefined;
  ticket.technicianEvidence = ev.value.length > 0 ? ev.value : [];
  ticket.status = "In progress";

  await ticket.save();

  return NextResponse.json({
    ok: true,
    id: String(ticket._id),
    status: ticket.status,
    assignedTechnicianId: String(ticket.assignedTechnicianId),
  });
}

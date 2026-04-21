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

function sanitizeComments(value: unknown): string {
  const raw = collapseSpaces(value);
  if (!raw) {
    return "";
  }
  return raw.slice(0, 10000);
}

async function authorizeTechnician(request: Request): Promise<{ id: string } | null> {
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
  if (appRole !== "TECHNICIAN") {
    return null;
  }

  return { id: collapseSpaces(row._id) };
}

function parseTargetStatus(raw: unknown): "Accepted" | "Resolved" | null {
  const s = collapseSpaces(raw);
  if (s === "Accepted" || s.toLowerCase() === "accepted") {
    return "Accepted";
  }
  if (s === "Resolved" || s.toLowerCase() === "resolved") {
    return "Resolved";
  }
  return null;
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

  const authorized = await authorizeTechnician(request);
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

  const nextStatus = parseTargetStatus(body.status);
  if (!nextStatus) {
    return NextResponse.json(
      { message: 'status must be "Accepted" or "Resolved"' },
      { status: 400 }
    );
  }

  const ticket = await SupportTicketModel.findById(id).exec().catch(() => null);
  if (!ticket) {
    return NextResponse.json({ message: "Ticket not found" }, { status: 404 });
  }

  const techId = ticket.assignedTechnicianId;
  if (!techId || String(techId) !== authorized.id) {
    return NextResponse.json(
      { message: "This ticket is not assigned to you" },
      { status: 403 }
    );
  }

  const current = normalizeSupportTicketStatus(ticket.status);

  if (nextStatus === "Accepted") {
    if (current !== "In progress") {
      return NextResponse.json(
        { message: 'Only tickets "In progress" can be accepted' },
        { status: 400 }
      );
    }
    ticket.status = "Accepted";
  } else {
    if (current !== "Accepted") {
      return NextResponse.json(
        { message: 'Only tickets in "Accepted" can be marked resolved' },
        { status: 400 }
      );
    }
    const resolutionNote = sanitizeComments(body.technicianComments);
    const ev = sanitizeTechnicianEvidence(body.technicianEvidence);
    if (!ev.ok) {
      return NextResponse.json({ message: ev.message }, { status: 400 });
    }
    const existingEv = ticket.technicianEvidence ?? [];
    const combined = [...existingEv, ...ev.value];
    if (combined.length > MAX_EVIDENCE_FILES) {
      return NextResponse.json(
        { message: `At most ${MAX_EVIDENCE_FILES} technician evidence files in total` },
        { status: 400 }
      );
    }
    ticket.technicianEvidence = combined;
    if (resolutionNote) {
      const prev = collapseSpaces(ticket.technicianComments);
      ticket.technicianComments = prev
        ? `${prev}\n\n— Resolution —\n${resolutionNote}`
        : resolutionNote;
    }
    ticket.status = "Resolved";
  }

  await ticket.save();

  return NextResponse.json({
    ok: true,
    id: String(ticket._id),
    status: ticket.status,
  });
}

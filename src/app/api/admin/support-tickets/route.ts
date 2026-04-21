import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Student";
import "@/models/SupportTicket";
import "@/models/User";
import { connectMongoose } from "@/models/mongoose";
import {
  SUPPORT_TICKET_STATUSES,
  SupportTicketModel,
  matchSupportTicketStatusCaseInsensitive,
  normalizeSupportTicketStatus,
  type SupportTicketStatus,
} from "@/models/SupportTicket";
import { UserModel } from "@/models/User";
import { type AppRole, toAppRoleFromUserRole } from "@/models/rbac";

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toIso(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  const raw = collapseSpaces(value);
  if (!raw) {
    return "";
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

/** Aligned with `getExpectedRoleForPath` for `/admin/tickets`: SUPER_ADMIN and TECHNICIAN. */
async function authorizeTicketsViewer(request: Request): Promise<{ id: string; appRole: AppRole } | null> {
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
  if (appRole !== "SUPER_ADMIN" && appRole !== "TECHNICIAN") {
    return null;
  }

  return { id: collapseSpaces(row._id), appRole };
}

function parseMineParam(raw: string | null): boolean {
  const s = collapseSpaces(raw).toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function parseStatus(param: string | null): SupportTicketStatus | null {
  if (!param) {
    return null;
  }
  const raw = collapseSpaces(param);
  if (SUPPORT_TICKET_STATUSES.includes(raw as SupportTicketStatus)) {
    return raw as SupportTicketStatus;
  }
  const lower = raw.toLowerCase();
  const friendly: Record<string, SupportTicketStatus> = {
    open: "Open",
    "in-progress": "In progress",
    "in progress": "In progress",
    resolved: "Resolved",
    withdrawn: "Withdrawn",
    withdraw: "Withdrawn",
    accepted: "Accepted",
  };
  return friendly[lower] ?? null;
}

export async function GET(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const authorized = await authorizeTicketsViewer(request);
  if (!authorized) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = parseStatus(url.searchParams.get("status"));
  if (!status) {
    return NextResponse.json(
      {
        message: `Missing or invalid status. Expected one of: ${SUPPORT_TICKET_STATUSES.join(
          ", "
        )} (URL-friendly aliases: open, in-progress, resolved, withdrawn, accepted).`,
      },
      { status: 400 }
    );
  }

  const mine = parseMineParam(url.searchParams.get("mine"));
  if (mine && authorized.appRole !== "TECHNICIAN") {
    return NextResponse.json(
      { message: "mine=1 lists tickets assigned to you and is only for technician accounts." },
      { status: 400 }
    );
  }

  const statusMatch = matchSupportTicketStatusCaseInsensitive(status);
  const listFilter =
    mine && authorized.appRole === "TECHNICIAN"
      ? {
          $and: [
            statusMatch,
            { assignedTechnicianId: new mongoose.Types.ObjectId(authorized.id) },
          ],
        }
      : statusMatch;

  /** Omit student `evidence` (large base64 blobs); list UI does not need file bytes. */
  let rows: unknown[];
  try {
    rows = (await SupportTicketModel.find(listFilter)
      .select({ evidence: 0 })
      .populate({
        path: "studentId",
        select: "studentId firstName lastName email",
      })
      .populate({
        path: "assignedTechnicianId",
        select: "fullName username email specialization role status",
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec()) as unknown[];
  } catch (err) {
    console.error("[GET /api/admin/support-tickets]", err);
    return NextResponse.json(
      { message: "Failed to load support tickets" },
      { status: 500 }
    );
  }

  const items = rows.map((raw) => {
    const row = raw as Record<string, unknown>;
    const sid = row.studentId;
    let student: {
      id: string;
      studentId: string;
      name: string;
      email: string;
    } | null = null;

    if (sid && typeof sid === "object" && !Array.isArray(sid)) {
      const s = sid as Record<string, unknown>;
      const first = collapseSpaces(s.firstName);
      const last = collapseSpaces(s.lastName);
      const name = [first, last].filter(Boolean).join(" ").trim();
      student = {
        id: String(s._id ?? ""),
        studentId: collapseSpaces(s.studentId),
        name: name || "—",
        email: collapseSpaces(s.email),
      };
    }

    const techRaw = row.assignedTechnicianId;
    let assignedTechnician: {
      id: string;
      fullName: string;
      username: string;
      email: string;
      specialization: string;
    } | null = null;
    if (techRaw && typeof techRaw === "object" && !Array.isArray(techRaw)) {
      const t = techRaw as Record<string, unknown>;
      assignedTechnician = {
        id: String(t._id ?? ""),
        fullName: collapseSpaces(t.fullName) || "—",
        username: collapseSpaces(t.username),
        email: collapseSpaces(t.email),
        specialization: collapseSpaces(t.specialization),
      };
    }

    const techEv = row.technicianEvidence;
    const technicianEvidencePreview: { fileName: string; mimeType: string }[] = [];
    if (Array.isArray(techEv)) {
      for (const item of techEv) {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          continue;
        }
        const e = item as Record<string, unknown>;
        technicianEvidencePreview.push({
          fileName: collapseSpaces(e.fileName).slice(0, 255),
          mimeType: collapseSpaces(e.mimeType).slice(0, 120),
        });
      }
    }

    return {
      id: String(row._id ?? ""),
      subject: collapseSpaces(row.subject),
      category: collapseSpaces(row.category),
      subcategory: collapseSpaces(row.subcategory),
      description: collapseSpaces(row.description),
      contactEmail: collapseSpaces(row.contactEmail),
      contactPhone: collapseSpaces(row.contactPhone),
      contactWhatsapp: collapseSpaces(row.contactWhatsapp),
      priority: collapseSpaces(row.priority),
      status: normalizeSupportTicketStatus(row.status),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
      student,
      assignedTechnician,
      technicianComments: collapseSpaces(row.technicianComments),
      technicianEvidencePreview,
    };
  });

  return NextResponse.json({ items, total: items.length, status });
}

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import "@/models/SupportTicket";
import { connectMongoose } from "@/models/mongoose";
import {
  SUPPORT_TICKET_PRIORITIES,
  SupportTicketModel,
  type SupportTicketPriority,
  type SupportTicketStatus,
  type ISupportTicketEvidence,
} from "@/models/SupportTicket";
import { resolveCurrentStudentId } from "@/app/api/consultation-bookings/shared";

const ALLOWED_CATEGORIES = new Set([
  "Technical",
  "Academic",
  "Booking",
  "Lost item",
  "Other",
]);

const MAX_EVIDENCE_FILES = 5;
/** ~550KB base64 per file (raw ~400KB). */
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
      return {
        ok: false,
        message: "Evidence must be images or PDF files",
      };
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

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toIso(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  const raw = collapseSpaces(value);
  if (!raw) {
    return new Date().toISOString();
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function evidenceFromDoc(raw: unknown): ISupportTicketEvidence[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) {
    return undefined;
  }
  const out: ISupportTicketEvidence[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const row = item as Record<string, unknown>;
    const fileName = typeof row.fileName === "string" ? row.fileName : "";
    const mimeType = typeof row.mimeType === "string" ? row.mimeType : "";
    const data = typeof row.data === "string" ? row.data : "";
    if (fileName && mimeType && data) {
      out.push({ fileName, mimeType, data });
    }
  }
  return out.length > 0 ? out : undefined;
}

function toApiTicket(row: {
  _id: unknown;
  subject?: string;
  category?: string;
  description?: string;
  priority?: string;
  status?: string;
  createdAt?: Date | string;
  evidence?: unknown;
}) {
  const createdAt = toIso(row.createdAt);
  const evidence = evidenceFromDoc(row.evidence);
  return {
    id: String(row._id),
    subject: collapseSpaces(row.subject),
    category: collapseSpaces(row.category),
    description: collapseSpaces(row.description),
    priority: row.priority as SupportTicketPriority,
    status: row.status as SupportTicketStatus,
    ...(evidence?.length ? { evidence } : {}),
    createdAt,
  };
}

function sanitizePriority(value: unknown): SupportTicketPriority | null {
  const raw = collapseSpaces(value);
  return SUPPORT_TICKET_PRIORITIES.includes(raw as SupportTicketPriority)
    ? (raw as SupportTicketPriority)
    : null;
}

export async function GET(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }

    const studentId = await resolveCurrentStudentId(request, mongooseConnection);
    if (!studentId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const rows = (await SupportTicketModel.find({ studentId })
      .sort({ createdAt: -1 })
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    const items = rows
      .map((row) => {
        const r = row as Record<string, unknown>;
        const createdRaw = r.createdAt;
        const createdAt =
          createdRaw instanceof Date
            ? createdRaw
            : typeof createdRaw === "string" || typeof createdRaw === "number"
              ? new Date(createdRaw)
              : undefined;
        return toApiTicket({
          _id: r._id,
          subject: typeof r.subject === "string" ? r.subject : "",
          category: typeof r.category === "string" ? r.category : "",
          description: typeof r.description === "string" ? r.description : "",
          priority: typeof r.priority === "string" ? r.priority : "",
          status: typeof r.status === "string" ? r.status : "",
          createdAt,
          evidence: r.evidence,
        });
      })
      .filter((item) => Boolean(item.id && item.subject));

    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to list support tickets",
      },
      { status: 500 }
    );
  }
}

type CreateBody = {
  subject?: unknown;
  category?: unknown;
  description?: unknown;
  priority?: unknown;
  evidence?: unknown;
};

export async function POST(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }

    const studentId = await resolveCurrentStudentId(request, mongooseConnection);
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as CreateBody | null;
    const subject = collapseSpaces(body?.subject);
    const description = collapseSpaces(body?.description);
    const category = collapseSpaces(body?.category);
    const priority = sanitizePriority(body?.priority);
    const evidenceParsed = sanitizeEvidence(body?.evidence);
    if (!evidenceParsed.ok) {
      return NextResponse.json({ message: evidenceParsed.message }, { status: 400 });
    }

    if (!subject || !description) {
      return NextResponse.json(
        { message: "Subject and description are required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_CATEGORIES.has(category)) {
      return NextResponse.json({ message: "Invalid category" }, { status: 400 });
    }

    if (!priority) {
      return NextResponse.json(
        { message: "Priority must be Low, Medium, or High" },
        { status: 400 }
      );
    }

    const created = await SupportTicketModel.create({
      studentId: new mongoose.Types.ObjectId(studentId),
      subject,
      category,
      description,
      priority,
      status: "Open",
      evidence: evidenceParsed.value.length > 0 ? evidenceParsed.value : [],
    });

    const plain = created.toObject({
      versionKey: false,
    });

    return NextResponse.json(
      toApiTicket({
        _id: plain._id,
        subject: plain.subject,
        category: plain.category,
        description: plain.description,
        priority: plain.priority,
        status: plain.status,
        evidence: plain.evidence,
        createdAt:
          plain.createdAt instanceof Date
            ? plain.createdAt
            : new Date(String(plain.createdAt ?? "")),
      }),
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to create support ticket",
      },
      { status: 500 }
    );
  }
}

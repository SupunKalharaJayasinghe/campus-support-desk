import { NextResponse } from "next/server";
import "@/models/ModuleOffering";
import { connectMongoose } from "@/models/mongoose";
import { findIntakeById, sanitizeIntakeId, type TermCode } from "@/models/intake-store";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import {
  normalizeDbOffering,
  parseTermCodeStrict,
  resolveAssigneeMaps,
  sanitizeId,
  toApiOfferingItem,
} from "@/models/module-offering-api";
import {
  listModuleOfferings,
  type ModuleOfferingRecord,
} from "@/models/module-offering-store";

function normalizeLower(value: string) {
  return String(value ?? "").trim().toLowerCase();
}

function mergeOfferingsByKey(rows: ModuleOfferingRecord[]) {
  const byKey = new Map<string, ModuleOfferingRecord>();

  rows.forEach((row) => {
    const intakeKey = normalizeLower(row.intakeName || row.intakeId);
    const moduleKey = String(row.moduleCode ?? "").trim().toUpperCase();
    if (!intakeKey || !moduleKey || !row.termCode) {
      return;
    }

    const key = `${intakeKey}::${row.termCode}::${moduleKey}`;
    const existing = byKey.get(key);
    if (!existing || existing.updatedAt.localeCompare(row.updatedAt) < 0) {
      byKey.set(key, row);
    }
  });

  return Array.from(byKey.values());
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const intakeId = sanitizeIntakeId(params.id);
  if (!intakeId) {
    return NextResponse.json({ message: "Intake id is required" }, { status: 400 });
  }

  const intake = findIntakeById(intakeId);
  if (!intake) {
    return NextResponse.json({ message: "Intake not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const termCodeRaw = sanitizeId(searchParams.get("termCode"));
  const termCode = termCodeRaw ? parseTermCodeStrict(termCodeRaw) : null;
  if (termCodeRaw && !termCode) {
    return NextResponse.json({ message: "Invalid termCode" }, { status: 400 });
  }

  const mongooseConnection = await connectMongoose().catch(() => null);
  let dbRows: ModuleOfferingRecord[] = [];

  if (mongooseConnection) {
    const query: Record<string, unknown> = {
      $or: [{ intakeId }, { intakeName: intake.name }],
    };
    if (termCode) {
      query.termCode = termCode;
    }

    const rows = (await ModuleOfferingModel.find(query)
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    dbRows = rows
      .map((row) => normalizeDbOffering(row))
      .filter((row): row is ModuleOfferingRecord => Boolean(row));
  }

  const storeRows = listModuleOfferings({
    intakeId,
    termCode: termCode ?? undefined,
  });
  const storeRowsByName = listModuleOfferings({
    intakeName: intake.name,
    termCode: termCode ?? undefined,
  });

  const intakeIdNormalized = normalizeLower(intakeId);
  const intakeNameNormalized = normalizeLower(intake.name);

  const items = mergeOfferingsByKey([...dbRows, ...storeRows, ...storeRowsByName])
    .filter((row) => !row.isDeleted)
    .filter((row) => (termCode ? row.termCode === (termCode as TermCode) : true))
    .filter(
      (row) =>
        normalizeLower(row.intakeId) === intakeIdNormalized ||
        normalizeLower(row.intakeName) === intakeNameNormalized
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const lecturerIds = Array.from(new Set(items.flatMap((item) => item.assignedLecturerIds)));
  const labAssistantIds = Array.from(
    new Set(items.flatMap((item) => item.assignedLabAssistantIds))
  );
  const assignees = await resolveAssigneeMaps(
    { lecturerIds, labAssistantIds },
    mongooseConnection
  );

  return NextResponse.json({
    intakeId: intake.id,
    intakeName: intake.name,
    termCode,
    total: items.length,
    items: items.map((item) => toApiOfferingItem(item, assignees)),
  });
}


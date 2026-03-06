import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/LabAssistant";
import "@/models/Lecturer";
import "@/models/ModuleOffering";
import { findDegreeProgram } from "@/lib/degree-program-store";
import { findFaculty } from "@/lib/faculty-store";
import { findIntakeById, sanitizeTermCode, type TermCode } from "@/lib/intake-store";
import {
  listLabAssistantsInMemory,
  toLabAssistantPersistedRecordFromUnknown,
  type LabAssistantPersistedRecord,
} from "@/lib/lab-assistant-store";
import {
  listLecturersInMemory,
  toLecturerPersistedRecordFromUnknown,
  type LecturerPersistedRecord,
} from "@/lib/lecturer-store";
import { connectMongoose } from "@/lib/mongoose";
import {
  createModuleOffering,
  deleteModuleOffering,
  listModuleOfferings,
  type ModuleOfferingRecord,
  type ModuleOfferingSort,
  type ModuleOfferingStatus,
  type SyllabusVersion,
} from "@/lib/module-offering-store";
import { findModuleById } from "@/lib/module-store";
import { LabAssistantModel } from "@/models/LabAssistant";
import { LecturerModel } from "@/models/Lecturer";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { isMongoDuplicateKeyError } from "@/lib/student-registration";

const TERM_SORT_ORDER: TermCode[] = [
  "Y1S1",
  "Y1S2",
  "Y2S1",
  "Y2S2",
  "Y3S1",
  "Y3S2",
  "Y4S1",
  "Y4S2",
];

interface AssigneeItem {
  id: string;
  fullName: string;
  email: string;
  status: string;
}

function parsePageParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parsePageSizeParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const nextValue = Math.floor(parsed);
  if (![10, 25, 50, 100].includes(nextValue)) {
    return fallback;
  }

  return nextValue;
}

function sanitizeSort(value: string | null): ModuleOfferingSort {
  if (value === "module" || value === "term") {
    return value;
  }

  return "updated";
}

function sanitizeStatus(value: string | null): "" | ModuleOfferingStatus {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "ACTIVE" || normalized === "INACTIVE") {
    return normalized;
  }

  return "";
}

function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function sanitizeSyllabus(value: unknown): SyllabusVersion {
  return value === "OLD" ? "OLD" : "NEW";
}

function sanitizeIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    )
  );
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toIsoDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString();
}

function normalizeDbOffering(value: unknown): ModuleOfferingRecord | null {
  const row = asObject(value);
  if (!row) {
    return null;
  }

  const id = String(row._id ?? row.id ?? "").trim();
  const intakeId = String(row.intakeId ?? "").trim();
  const moduleId = String(row.moduleId ?? "").trim();
  if (!id || !intakeId || !moduleId) {
    return null;
  }

  const intake = findIntakeById(intakeId);
  const moduleRecord = findModuleById(moduleId);
  const assignedLecturerIds = sanitizeIdList(
    row.assignedLecturerIds ?? row.assignedLecturers
  );
  const now = new Date().toISOString();
  const createdAt = toIsoDate(row.createdAt);
  const updatedAt = toIsoDate(row.updatedAt);

  return {
    id,
    facultyId: normalizeAcademicCode(row.facultyId ?? intake?.facultyCode),
    degreeProgramId: normalizeAcademicCode(
      row.degreeProgramId ?? intake?.degreeCode
    ),
    intakeId,
    termCode: sanitizeTermCode(row.termCode),
    moduleId,
    moduleCode:
      String(row.moduleCode ?? moduleRecord?.code ?? "")
        .trim()
        .toUpperCase() || moduleId.toUpperCase(),
    moduleName:
      String(row.moduleName ?? moduleRecord?.name ?? "").trim() ||
      String(moduleRecord?.code ?? moduleId).trim(),
    syllabusVersion: sanitizeSyllabus(row.syllabusVersion),
    assignedLecturerIds,
    assignedLabAssistantIds: sanitizeIdList(row.assignedLabAssistantIds),
    status: row.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    assignedLecturers: assignedLecturerIds,
    outlineWeeks: [],
    outlinePending: row.outlinePending === true,
    hasGrades: row.hasGrades === true,
    hasAttendance: row.hasAttendance === true,
    hasContent: row.hasContent === true,
    createdAt: createdAt || updatedAt || now,
    updatedAt: updatedAt || createdAt || now,
    isDeleted: row.isDeleted === true,
  };
}

function filterAndSortOfferings(
  rows: ModuleOfferingRecord[],
  options: {
    facultyId: string;
    degreeProgramId: string;
    intakeId: string;
    termCode: TermCode | null;
    moduleId: string;
    status: "" | ModuleOfferingStatus;
    search: string;
    sort: ModuleOfferingSort;
  }
) {
  const filtered = rows
    .filter((offering) => !offering.isDeleted)
    .filter((offering) => (options.facultyId ? offering.facultyId === options.facultyId : true))
    .filter((offering) =>
      options.degreeProgramId ? offering.degreeProgramId === options.degreeProgramId : true
    )
    .filter((offering) => (options.intakeId ? offering.intakeId === options.intakeId : true))
    .filter((offering) => (options.termCode ? offering.termCode === options.termCode : true))
    .filter((offering) => (options.moduleId ? offering.moduleId === options.moduleId : true))
    .filter((offering) => (options.status ? offering.status === options.status : true))
    .filter((offering) => {
      if (!options.search) {
        return true;
      }

      return `${offering.moduleCode} ${offering.moduleName}`
        .toLowerCase()
        .includes(options.search);
    });

  return filtered.sort((left, right) => {
    if (options.sort === "module") {
      const codeCompare = left.moduleCode.localeCompare(right.moduleCode);
      if (codeCompare !== 0) {
        return codeCompare;
      }

      const termCompare =
        TERM_SORT_ORDER.indexOf(left.termCode) - TERM_SORT_ORDER.indexOf(right.termCode);
      if (termCompare !== 0) {
        return termCompare;
      }
    }

    if (options.sort === "term") {
      const termCompare =
        TERM_SORT_ORDER.indexOf(left.termCode) - TERM_SORT_ORDER.indexOf(right.termCode);
      if (termCompare !== 0) {
        return termCompare;
      }

      const codeCompare = left.moduleCode.localeCompare(right.moduleCode);
      if (codeCompare !== 0) {
        return codeCompare;
      }
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

async function resolveAssigneeMaps(
  input: {
    lecturerIds: string[];
    labAssistantIds: string[];
  },
  mongooseConnection: typeof mongoose | null
) {
  const lecturerMap = new Map<string, AssigneeItem>();
  listLecturersInMemory().forEach((row) => {
    lecturerMap.set(row.id, {
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      status: row.status,
    });
  });

  const labAssistantMap = new Map<string, AssigneeItem>();
  listLabAssistantsInMemory().forEach((row) => {
    labAssistantMap.set(row.id, {
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      status: row.status,
    });
  });

  if (!mongooseConnection) {
    return { lecturerMap, labAssistantMap };
  }

  const lecturerObjectIds = input.lecturerIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (lecturerObjectIds.length > 0) {
    const lecturerRows = (await LecturerModel.find({
      _id: { $in: lecturerObjectIds },
    })
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    lecturerRows
      .map((row) => toLecturerPersistedRecordFromUnknown(row))
      .filter((row): row is LecturerPersistedRecord => Boolean(row))
      .forEach((row) => {
        lecturerMap.set(row.id, {
          id: row.id,
          fullName: row.fullName,
          email: row.email,
          status: row.status,
        });
      });
  }

  const labAssistantObjectIds = input.labAssistantIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (labAssistantObjectIds.length > 0) {
    const labRows = (await LabAssistantModel.find({
      _id: { $in: labAssistantObjectIds },
    })
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    labRows
      .map((row) => toLabAssistantPersistedRecordFromUnknown(row))
      .filter((row): row is LabAssistantPersistedRecord => Boolean(row))
      .forEach((row) => {
        labAssistantMap.set(row.id, {
          id: row.id,
          fullName: row.fullName,
          email: row.email,
          status: row.status,
        });
      });
  }

  return { lecturerMap, labAssistantMap };
}

function toApiItem(
  offering: ModuleOfferingRecord,
  assignees: {
    lecturerMap: Map<string, AssigneeItem>;
    labAssistantMap: Map<string, AssigneeItem>;
  }
) {
  const faculty = findFaculty(offering.facultyId);
  const degree = findDegreeProgram(offering.degreeProgramId);
  const intake = findIntakeById(offering.intakeId);
  const moduleRecord = findModuleById(offering.moduleId);

  const lecturers = offering.assignedLecturerIds.map((id) => {
    const row = assignees.lecturerMap.get(id);
    return {
      _id: id,
      id,
      fullName: row?.fullName ?? "Unknown Lecturer",
      email: row?.email ?? "",
      status: row?.status ?? "INACTIVE",
    };
  });

  const labAssistants = offering.assignedLabAssistantIds.map((id) => {
    const row = assignees.labAssistantMap.get(id);
    return {
      _id: id,
      id,
      fullName: row?.fullName ?? "Unknown Lab Assistant",
      email: row?.email ?? "",
      status: row?.status ?? "INACTIVE",
    };
  });

  return {
    id: offering.id,
    _id: offering.id,
    facultyId: offering.facultyId,
    degreeProgramId: offering.degreeProgramId,
    intakeId: offering.intakeId,
    termCode: offering.termCode,
    moduleId: offering.moduleId,
    moduleCode: offering.moduleCode || moduleRecord?.code || "",
    moduleName: offering.moduleName || moduleRecord?.name || "",
    syllabusVersion: offering.syllabusVersion,
    status: offering.status,
    assignedLecturerIds: offering.assignedLecturerIds,
    assignedLabAssistantIds: offering.assignedLabAssistantIds,
    assignedLecturers: offering.assignedLecturerIds,
    lecturers,
    labAssistants,
    lecturerCount: lecturers.length,
    labAssistantCount: labAssistants.length,
    module: {
      id: offering.moduleId,
      code: offering.moduleCode || moduleRecord?.code || "",
      name: offering.moduleName || moduleRecord?.name || "",
    },
    faculty: {
      code: offering.facultyId,
      name: faculty?.name ?? "",
    },
    degree: {
      code: offering.degreeProgramId,
      name: degree?.name ?? "",
    },
    intake: {
      id: offering.intakeId,
      name: intake?.name ?? "",
      currentTerm: intake?.currentTerm ?? "",
    },
    createdAt: offering.createdAt,
    updatedAt: offering.updatedAt,
  };
}

export async function GET(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  const { searchParams } = new URL(request.url);

  const facultyId = normalizeAcademicCode(searchParams.get("facultyId"));
  const degreeProgramId = normalizeAcademicCode(searchParams.get("degreeProgramId"));
  const intakeId = String(searchParams.get("intakeId") ?? "").trim();
  const termCodeRaw = String(searchParams.get("termCode") ?? "").trim();
  const termCode = termCodeRaw ? sanitizeTermCode(termCodeRaw) : null;
  const moduleId = String(searchParams.get("moduleId") ?? "").trim();
  const search = String(searchParams.get("search") ?? "").trim().toLowerCase();
  const sort = sanitizeSort(searchParams.get("sort"));
  const status = sanitizeStatus(searchParams.get("status"));
  const pageSize = parsePageSizeParam(
    searchParams.get("pageSize") ?? searchParams.get("limit"),
    25
  );
  const page = parsePageParam(searchParams.get("page"), 1);

  let allItems: ModuleOfferingRecord[] = [];
  let shouldUseStoreFallback = true;

  if (mongooseConnection) {
    const hasAnyDbRows = Boolean(
      await ModuleOfferingModel.exists({}).catch(() => null)
    );
    shouldUseStoreFallback = !hasAnyDbRows;

    const query: Record<string, unknown> = {};
    if (facultyId) {
      query.facultyId = facultyId;
    }
    if (degreeProgramId) {
      query.degreeProgramId = degreeProgramId;
    }
    if (intakeId) {
      query.intakeId = intakeId;
    }
    if (termCode) {
      query.termCode = termCode;
    }
    if (moduleId) {
      query.moduleId = moduleId;
    }
    if (status) {
      query.status = status;
    }

    const rows = (await ModuleOfferingModel.find(query)
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    allItems = filterAndSortOfferings(
      rows
        .map((row) => normalizeDbOffering(row))
        .filter((row): row is ModuleOfferingRecord => Boolean(row)),
      {
        facultyId,
        degreeProgramId,
        intakeId,
        termCode,
        moduleId,
        status,
        search,
        sort,
      }
    );
  }

  if (shouldUseStoreFallback) {
    allItems = listModuleOfferings({
      facultyId,
      degreeProgramId,
      intakeId,
      termCode: termCode ?? undefined,
      moduleId,
      status,
      search,
      sort,
    });
  }

  const total = allItems.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const pagedItems = allItems.slice(start, start + pageSize);

  const lecturerIds = Array.from(
    new Set(pagedItems.flatMap((item) => item.assignedLecturerIds))
  );
  const labAssistantIds = Array.from(
    new Set(pagedItems.flatMap((item) => item.assignedLabAssistantIds))
  );
  const assignees = await resolveAssigneeMaps(
    { lecturerIds, labAssistantIds },
    mongooseConnection
  );

  return NextResponse.json({
    items: pagedItems.map((item) => toApiItem(item, assignees)),
    page: safePage,
    pageSize,
    total,
  });
}

export async function POST(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    const body = (await request.json()) as Partial<{
      facultyId: string;
      degreeProgramId: string;
      intakeId: string;
      termCode: TermCode;
      moduleId: string;
      syllabusVersion: SyllabusVersion;
      assignedLecturerIds: string[];
      assignedLabAssistantIds: string[];
      assignedLecturers: string[];
      status: ModuleOfferingStatus;
    }>;

    if (!body.moduleId) {
      return NextResponse.json({ message: "Module is required" }, { status: 400 });
    }
    if (!body.termCode) {
      return NextResponse.json({ message: "Term is required" }, { status: 400 });
    }
    if (!body.intakeId) {
      return NextResponse.json({ message: "Intake is required" }, { status: 400 });
    }
    if (!body.syllabusVersion) {
      return NextResponse.json({ message: "Syllabus version is required" }, { status: 400 });
    }

    if (mongooseConnection) {
      const exists = await ModuleOfferingModel.exists({
        intakeId: String(body.intakeId ?? "").trim(),
        termCode: sanitizeTermCode(body.termCode),
        moduleId: String(body.moduleId ?? "").trim(),
      }).catch(() => null);

      if (exists) {
        return NextResponse.json(
          { message: "Module is already assigned for this intake term" },
          { status: 409 }
        );
      }
    }

    const created = createModuleOffering({
      facultyId: normalizeAcademicCode(body.facultyId),
      degreeProgramId: normalizeAcademicCode(body.degreeProgramId),
      intakeId: String(body.intakeId ?? "").trim(),
      termCode: sanitizeTermCode(body.termCode),
      moduleId: String(body.moduleId ?? "").trim(),
      syllabusVersion: sanitizeSyllabus(body.syllabusVersion),
      assignedLecturerIds: sanitizeIdList(
        body.assignedLecturerIds ?? body.assignedLecturers
      ),
      assignedLabAssistantIds: sanitizeIdList(body.assignedLabAssistantIds),
      status: body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    });

    if (mongooseConnection) {
      try {
        await ModuleOfferingModel.create({
          facultyId: created.facultyId,
          degreeProgramId: created.degreeProgramId,
          intakeId: created.intakeId,
          termCode: created.termCode,
          moduleId: created.moduleId,
          syllabusVersion: created.syllabusVersion,
          assignedLecturerIds: created.assignedLecturerIds,
          assignedLabAssistantIds: created.assignedLabAssistantIds,
          status: created.status,
          assignedLecturers: created.assignedLecturerIds,
          outlineWeeks: created.outlineWeeks,
          outlinePending: created.outlinePending,
          hasGrades: created.hasGrades,
          hasAttendance: created.hasAttendance,
          hasContent: created.hasContent,
        });
      } catch (error) {
        deleteModuleOffering(created.id);
        if (isMongoDuplicateKeyError(error)) {
          return NextResponse.json(
            { message: "Module is already assigned for this intake term" },
            { status: 409 }
          );
        }

        throw error;
      }
    }

    const assignees = await resolveAssigneeMaps(
      {
        lecturerIds: created.assignedLecturerIds,
        labAssistantIds: created.assignedLabAssistantIds,
      },
      mongooseConnection
    );
    return NextResponse.json(toApiItem(created, assignees), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to create module offering",
      },
      { status: 400 }
    );
  }
}

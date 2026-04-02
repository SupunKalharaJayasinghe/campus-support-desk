import { NextResponse } from "next/server";
import "@/models/LabAssistant";
import "@/models/Lecturer";
import "@/models/ModuleOffering";
import { connectMongoose } from "@/models/mongoose";
import {
  mergeSanitizedIdLists,
  normalizeAcademicCode,
  normalizeIntakeName,
  normalizeModuleCode,
  normalizeDbOffering,
  parseTermCodeStrict,
  resolveAssigneeMaps,
  resolveOfferingContext,
  sanitizeId,
  sanitizeIdList,
  sanitizeOfferingStatus,
  sanitizeSyllabusVersion,
  toApiOfferingItem,
  validateLabAssistantAssignments,
  validateLecturerAssignments,
} from "@/models/module-offering-api";
import {
  createModuleOffering,
  deleteModuleOffering,
  listModuleOfferings,
  type ModuleOfferingRecord,
  type ModuleOfferingSort,
  type ModuleOfferingStatus,
  type SyllabusVersion,
} from "@/models/module-offering-store";
import { listTermOptions, type TermCode } from "@/models/intake-store";
import { isMongoDuplicateKeyError } from "@/models/student-registration";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { syncLecturerModuleLinksForOfferingMutation } from "@/models/module-offering-lecturer-module-sync";

const TERM_SORT_ORDER = listTermOptions();

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

function sanitizeStatusFilter(value: string | null): "" | ModuleOfferingStatus {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "ACTIVE" || normalized === "INACTIVE") {
    return normalized;
  }

  return "";
}

function normalizeLower(value: string) {
  return String(value ?? "").trim().toLowerCase();
}

function mergeOfferingsByKey(rows: ModuleOfferingRecord[]) {
  const byKey = new Map<string, ModuleOfferingRecord>();

  rows.forEach((row) => {
    const intakeKey = normalizeLower(row.intakeName || row.intakeId);
    const moduleKey = normalizeModuleCode(row.moduleCode || row.moduleId);
    if (!intakeKey || !moduleKey || !row.termCode) {
      return;
    }

    const key = `${intakeKey}::${row.termCode}::${moduleKey}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      return;
    }

    if (existing.updatedAt.localeCompare(row.updatedAt) < 0) {
      byKey.set(key, row);
    }
  });

  return Array.from(byKey.values());
}

function filterAndSortOfferings(
  rows: ModuleOfferingRecord[],
  options: {
    facultyCode: string;
    degreeCode: string;
    intakeName: string;
    intakeId: string;
    termCode: TermCode | null;
    moduleCode: string;
    moduleId: string;
    status: "" | ModuleOfferingStatus;
    search: string;
    sort: ModuleOfferingSort;
  }
) {
  const intakeIdNormalized = normalizeLower(options.intakeId);
  const intakeNameNormalized = normalizeLower(options.intakeName);
  const moduleIdNormalized = String(options.moduleId ?? "").trim();
  const moduleCodeFromModuleId = normalizeModuleCode(moduleIdNormalized);

  const filtered = rows
    .filter((offering) => !offering.isDeleted)
    .filter((offering) =>
      options.facultyCode ? offering.facultyCode === options.facultyCode : true
    )
    .filter((offering) =>
      options.degreeCode ? offering.degreeCode === options.degreeCode : true
    )
    .filter((offering) =>
      intakeNameNormalized
        ? normalizeLower(offering.intakeName) === intakeNameNormalized
        : true
    )
    .filter((offering) =>
      intakeIdNormalized
        ? normalizeLower(offering.intakeId) === intakeIdNormalized ||
          normalizeLower(offering.intakeName) === intakeIdNormalized
        : true
    )
    .filter((offering) => (options.termCode ? offering.termCode === options.termCode : true))
    .filter((offering) => (options.moduleCode ? offering.moduleCode === options.moduleCode : true))
    .filter((offering) =>
      moduleIdNormalized
        ? offering.moduleId === moduleIdNormalized ||
          offering.moduleCode === moduleCodeFromModuleId
        : true
    )
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

function isDuplicateMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /already assigned/i.test(error.message);
}

export async function GET(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  const { searchParams } = new URL(request.url);

  const facultyCode = normalizeAcademicCode(
    searchParams.get("facultyCode") ?? searchParams.get("facultyId")
  );
  const degreeCode = normalizeAcademicCode(
    searchParams.get("degreeCode") ??
      searchParams.get("degreeProgramId") ??
      searchParams.get("degreeId")
  );
  const intakeName = normalizeIntakeName(searchParams.get("intakeName"));
  const intakeId = sanitizeId(searchParams.get("intakeId"));
  const termCodeRaw = sanitizeId(searchParams.get("termCode"));
  const termCode = termCodeRaw ? parseTermCodeStrict(termCodeRaw) : null;
  if (termCodeRaw && !termCode) {
    return NextResponse.json(
      { message: "Invalid termCode filter" },
      { status: 400 }
    );
  }

  const moduleCode = normalizeModuleCode(searchParams.get("moduleCode"));
  const moduleId = sanitizeId(searchParams.get("moduleId"));
  const search = String(searchParams.get("search") ?? "").trim().toLowerCase();
  const sort = sanitizeSort(searchParams.get("sort"));
  const status = sanitizeStatusFilter(searchParams.get("status"));
  const pageSize = parsePageSizeParam(
    searchParams.get("pageSize") ?? searchParams.get("limit"),
    10
  );
  const page = parsePageParam(searchParams.get("page"), 1);

  const filterOptions = {
    facultyCode,
    degreeCode,
    intakeName,
    intakeId,
    termCode,
    moduleCode,
    moduleId,
    status,
    search,
    sort,
  } satisfies Parameters<typeof filterAndSortOfferings>[1];

  let sourceRows: ModuleOfferingRecord[] = [];

  if (mongooseConnection) {
    const query: Record<string, unknown> = {};
    if (termCode) {
      query.termCode = termCode;
    }
    if (status) {
      query.status = status;
    }

    const rows = (await ModuleOfferingModel.find(query)
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    sourceRows = rows
      .map((row) => normalizeDbOffering(row))
      .filter((row): row is ModuleOfferingRecord => Boolean(row));
  } else {
    sourceRows = listModuleOfferings({
      termCode: termCode ?? undefined,
      status,
      search,
      sort,
    });
  }

  const allItems = filterAndSortOfferings(
    mergeOfferingsByKey(sourceRows),
    filterOptions
  );

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
    {
      lecturerIds,
      labAssistantIds,
    },
    mongooseConnection
  );

  return NextResponse.json({
    items: pagedItems.map((item) => toApiOfferingItem(item, assignees)),
    page: safePage,
    pageSize,
    total,
  });
}

export async function POST(request: Request) {
  let createdInStoreId: string | null = null;

  try {
    const body = (await request.json()) as Partial<{
      facultyCode: string;
      degreeCode: string;
      intakeName: string;
      moduleCode: string;
      facultyId: string;
      degreeProgramId: string;
      intakeId: string;
      termCode: string;
      moduleId: string;
      syllabusVersion: SyllabusVersion;
      assignedLecturerIds: string[];
      assignedLabAssistantIds: string[];
      assignedLecturers: string[];
      status: ModuleOfferingStatus;
    }>;

    const context = resolveOfferingContext({
      facultyCode: body.facultyCode,
      degreeCode: body.degreeCode,
      intakeName: body.intakeName,
      moduleCode: body.moduleCode,
      facultyId: body.facultyId,
      degreeProgramId: body.degreeProgramId,
      intakeId: body.intakeId,
      termCode: body.termCode,
      moduleId: body.moduleId,
    });

    const syllabusVersion =
      body.syllabusVersion === undefined
        ? context.defaultSyllabusVersion
        : sanitizeSyllabusVersion(body.syllabusVersion);
    const status = sanitizeOfferingStatus(body.status);
    const assignedLecturerIds = mergeSanitizedIdLists(
      body.assignedLecturerIds,
      body.assignedLecturers
    );
    const assignedLabAssistantIds = sanitizeIdList(body.assignedLabAssistantIds);

    const mongooseConnection = await connectMongoose({
      forceAcademicCacheSync: true,
    }).catch(() => null);

    await validateLecturerAssignments({
      ids: assignedLecturerIds,
      scope: {
        facultyCode: context.facultyCode,
        degreeCode: context.degreeCode,
        moduleCode: context.moduleCode,
        moduleId: context.moduleId,
      },
      mongooseConnection,
    });

    await validateLabAssistantAssignments({
      ids: assignedLabAssistantIds,
      scope: {
        facultyCode: context.facultyCode,
        degreeCode: context.degreeCode,
        moduleCode: context.moduleCode,
        moduleId: context.moduleId,
      },
      mongooseConnection,
    });

    const assigneeMaps = await resolveAssigneeMaps(
      {
        lecturerIds: assignedLecturerIds,
        labAssistantIds: assignedLabAssistantIds,
      },
      mongooseConnection
    );

    const assignedLecturers = assignedLecturerIds.map((id) => {
      const row = assigneeMaps.lecturerMap.get(id);
      return {
        lecturerId: id,
        name: row?.fullName ?? "",
        email: row?.email ?? "",
      };
    });
    const assignedLabAssistants = assignedLabAssistantIds.map((id) => {
      const row = assigneeMaps.labAssistantMap.get(id);
      return {
        assistantId: id,
        name: row?.fullName ?? "",
        email: row?.email ?? "",
      };
    });

    if (mongooseConnection) {
      const dbDuplicate = await ModuleOfferingModel.exists({
        termCode: context.termCode,
        $or: [
          {
            intakeName: context.intakeName,
            moduleCode: context.moduleCode,
          },
          {
            intakeId: context.intakeId,
            moduleId: context.moduleId,
          },
        ],
      }).catch(() => null);

      if (dbDuplicate) {
        return NextResponse.json(
          { message: "Module is already assigned for this intake term" },
          { status: 409 }
        );
      }
    } else {
      const storeDuplicate = listModuleOfferings({
        intakeName: context.intakeName,
        termCode: context.termCode,
        moduleCode: context.moduleCode,
      }).some((row) => !row.isDeleted);

      if (storeDuplicate) {
        return NextResponse.json(
          { message: "Module is already assigned for this intake term" },
          { status: 409 }
        );
      }
    }

    const created = createModuleOffering({
      facultyCode: context.facultyCode,
      degreeCode: context.degreeCode,
      intakeName: context.intakeName,
      moduleCode: context.moduleCode,
      facultyId: context.facultyCode,
      degreeProgramId: context.degreeCode,
      intakeId: context.intakeId,
      termCode: context.termCode,
      moduleId: context.moduleId,
      syllabusVersion,
      assignedLecturerIds,
      assignedLabAssistantIds,
      status,
    });
    createdInStoreId = created.id;

    let responseOffering = created;

    if (mongooseConnection) {
      try {
        const dbCreated = await ModuleOfferingModel.create({
          facultyCode: created.facultyCode,
          degreeCode: created.degreeCode,
          intakeName: created.intakeName,
          moduleCode: created.moduleCode,
          moduleName: created.moduleName,
          facultyId: created.facultyId,
          degreeProgramId: created.degreeProgramId,
          intakeId: created.intakeId,
          termCode: created.termCode,
          moduleId: created.moduleId,
          syllabusVersion: created.syllabusVersion,
          assignedLecturerIds: created.assignedLecturerIds,
          assignedLabAssistantIds: created.assignedLabAssistantIds,
          assignedLecturers,
          assignedLabAssistants,
          status: created.status,
          outlineWeeks: created.outlineWeeks,
          outlinePending: created.outlinePending,
          hasGrades: created.hasGrades,
          hasAttendance: created.hasAttendance,
          hasContent: created.hasContent,
        });

        const normalized = normalizeDbOffering(dbCreated.toObject());
        if (normalized) {
          responseOffering = normalized;
        }

        // MongoDB is authoritative when connected; prevent stale duplicate rows in memory.
        if (createdInStoreId) {
          deleteModuleOffering(createdInStoreId);
          createdInStoreId = null;
        }
      } catch (error) {
        if (createdInStoreId) {
          deleteModuleOffering(createdInStoreId);
        }

        if (isMongoDuplicateKeyError(error)) {
          return NextResponse.json(
            { message: "Module is already assigned for this intake term" },
            { status: 409 }
          );
        }

        throw error;
      }
    }

    await syncLecturerModuleLinksForOfferingMutation({
      previous: {
        offeringId: responseOffering.id,
        moduleCode: responseOffering.moduleCode,
        moduleId: responseOffering.moduleId,
        lecturerIds: [],
      },
      next: {
        offeringId: responseOffering.id,
        moduleCode: responseOffering.moduleCode,
        moduleId: responseOffering.moduleId,
        lecturerIds: responseOffering.assignedLecturerIds,
      },
      mongooseConnection,
    }).catch(() => null);

    return NextResponse.json(toApiOfferingItem(responseOffering, assigneeMaps), {
      status: 201,
    });
  } catch (error) {
    if (createdInStoreId) {
      deleteModuleOffering(createdInStoreId);
    }

    if (isDuplicateMessage(error)) {
      return NextResponse.json(
        { message: "Module is already assigned for this intake term" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to create module offering",
      },
      { status: 400 }
    );
  }
}


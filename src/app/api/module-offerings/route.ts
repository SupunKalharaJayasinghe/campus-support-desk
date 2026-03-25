import { NextResponse } from "next/server";
import "@/models/LabAssistant";
import "@/models/Lecturer";
import "@/models/ModuleOffering";
import { connectMongoose } from "@/lib/mongoose";
import {
  normalizeAcademicCode,
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
} from "@/lib/module-offering-api";
import {
  createModuleOffering,
  deleteModuleOffering,
  listModuleOfferings,
  type ModuleOfferingRecord,
  type ModuleOfferingSort,
  type ModuleOfferingStatus,
  type SyllabusVersion,
} from "@/lib/module-offering-store";
import { listTermOptions, type TermCode } from "@/lib/intake-store";
import { isMongoDuplicateKeyError } from "@/lib/student-registration";
import { ModuleOfferingModel } from "@/models/ModuleOffering";

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

function isDuplicateMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /already assigned/i.test(error.message);
}

export async function GET(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  const { searchParams } = new URL(request.url);

  const facultyId = normalizeAcademicCode(searchParams.get("facultyId"));
  const degreeProgramId = normalizeAcademicCode(searchParams.get("degreeProgramId"));
  const intakeId = sanitizeId(searchParams.get("intakeId"));
  const termCodeRaw = sanitizeId(searchParams.get("termCode"));
  const termCode = termCodeRaw ? parseTermCodeStrict(termCodeRaw) : null;
  if (termCodeRaw && !termCode) {
    return NextResponse.json(
      { message: "Invalid termCode filter" },
      { status: 400 }
    );
  }

  const moduleId = sanitizeId(searchParams.get("moduleId"));
  const search = String(searchParams.get("search") ?? "").trim().toLowerCase();
  const sort = sanitizeSort(searchParams.get("sort"));
  const status = sanitizeStatusFilter(searchParams.get("status"));
  const pageSize = parsePageSizeParam(
    searchParams.get("pageSize") ?? searchParams.get("limit"),
    10
  );
  const page = parsePageParam(searchParams.get("page"), 1);

  let allItems: ModuleOfferingRecord[] = [];
  let shouldUseStoreFallback = true;

  if (mongooseConnection) {
    const hasAnyDbRows = Boolean(await ModuleOfferingModel.exists({}).catch(() => null));
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
    const assignedLecturerIds = sanitizeIdList(
      body.assignedLecturerIds ?? body.assignedLecturers
    );
    const assignedLabAssistantIds = sanitizeIdList(body.assignedLabAssistantIds);

    const mongooseConnection = await connectMongoose().catch(() => null);

    await validateLecturerAssignments({
      ids: assignedLecturerIds,
      scope: {
        facultyId: context.facultyId,
        degreeProgramId: context.degreeProgramId,
        moduleId: context.moduleId,
      },
      mongooseConnection,
    });

    await validateLabAssistantAssignments({
      ids: assignedLabAssistantIds,
      scope: {
        facultyId: context.facultyId,
        degreeProgramId: context.degreeProgramId,
        moduleId: context.moduleId,
      },
      mongooseConnection,
    });

    if (mongooseConnection) {
      const dbDuplicate = await ModuleOfferingModel.exists({
        intakeId: context.intakeId,
        termCode: context.termCode,
        moduleId: context.moduleId,
      }).catch(() => null);

      if (dbDuplicate) {
        return NextResponse.json(
          { message: "Module is already assigned for this intake term" },
          { status: 409 }
        );
      }
    } else {
      const storeDuplicate = listModuleOfferings({
        intakeId: context.intakeId,
        termCode: context.termCode,
        moduleId: context.moduleId,
      }).some((row) => !row.isDeleted);

      if (storeDuplicate) {
        return NextResponse.json(
          { message: "Module is already assigned for this intake term" },
          { status: 409 }
        );
      }
    }

    const created = createModuleOffering({
      facultyId: context.facultyId,
      degreeProgramId: context.degreeProgramId,
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

        const normalized = normalizeDbOffering(dbCreated.toObject());
        if (normalized) {
          responseOffering = normalized;
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

    const assignees = await resolveAssigneeMaps(
      {
        lecturerIds: responseOffering.assignedLecturerIds,
        labAssistantIds: responseOffering.assignedLabAssistantIds,
      },
      mongooseConnection
    );

    return NextResponse.json(toApiOfferingItem(responseOffering, assignees), {
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

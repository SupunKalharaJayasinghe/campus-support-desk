import mongoose from "mongoose";
import { DegreeProgramModel } from "@/models/DegreeProgram";
import { FacultyModel } from "@/models/Faculty";
import { ModuleModel } from "@/models/Module";

export class StaffEligibilityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffEligibilityValidationError";
  }
}

interface StaffEligibilityInput {
  facultyIds: string[];
  degreeProgramIds: string[];
  moduleIds: string[];
}

interface ModuleEligibilityRecord {
  id: string;
  code: string;
  facultyCode: string;
  applicableDegrees: string[];
}

function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function normalizeModuleCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

function sanitizeAcademicCodeList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.map((item) => normalizeAcademicCode(item)).filter(Boolean))
  );
}

function sanitizeModuleIdList(value: unknown) {
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

function failValidation(message: string): never {
  throw new StaffEligibilityValidationError(message);
}

function moduleKeyCandidates(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return [] as string[];
  }

  const normalizedCode = normalizeModuleCode(raw);
  const set = new Set<string>([raw, raw.toLowerCase()]);
  if (normalizedCode) {
    set.add(normalizedCode);
  }

  return Array.from(set);
}

function buildModuleLookupMap(rows: ModuleEligibilityRecord[]) {
  const map = new Map<string, ModuleEligibilityRecord>();

  rows.forEach((row) => {
    const id = String(row.id ?? "").trim();
    const code = normalizeModuleCode(row.code);
    if (id) {
      map.set(id, row);
      map.set(id.toLowerCase(), row);
    }
    if (code) {
      map.set(code, row);
    }
  });

  return map;
}

function resolveModuleRecord(
  moduleId: string,
  moduleLookup: Map<string, ModuleEligibilityRecord>
) {
  const candidates = moduleKeyCandidates(moduleId);
  for (const candidate of candidates) {
    const found = moduleLookup.get(candidate);
    if (found) {
      return found;
    }
  }

  return null;
}

async function readModuleEligibilityRows(moduleIds: string[]) {
  const objectIdHexSet = new Set<string>();
  const moduleObjectIds: mongoose.Types.ObjectId[] = [];
  moduleIds.forEach((moduleId) => {
    if (!mongoose.Types.ObjectId.isValid(moduleId)) {
      return;
    }
    const objectId = new mongoose.Types.ObjectId(moduleId);
    const hex = objectId.toHexString();
    if (objectIdHexSet.has(hex)) {
      return;
    }
    objectIdHexSet.add(hex);
    moduleObjectIds.push(objectId);
  });

  const moduleCodes = Array.from(
    new Set(moduleIds.map((moduleId) => normalizeModuleCode(moduleId)).filter(Boolean))
  );

  const queryOr: Array<Record<string, unknown>> = [];
  if (moduleObjectIds.length > 0) {
    queryOr.push({ _id: { $in: moduleObjectIds } });
  }
  if (moduleCodes.length > 0) {
    queryOr.push({ code: { $in: moduleCodes } });
  }

  if (queryOr.length === 0) {
    return [] as ModuleEligibilityRecord[];
  }

  const rows = (await ModuleModel.find(
    { $or: queryOr },
    { code: 1, facultyCode: 1, applicableDegrees: 1 }
  )
    .lean()
    .exec()) as Array<{
    _id?: unknown;
    code?: unknown;
    facultyCode?: unknown;
    applicableDegrees?: unknown;
  }>;

  return rows
    .map((row) => {
      const id = String(row._id ?? "").trim();
      const code = normalizeModuleCode(row.code);
      const facultyCode = normalizeAcademicCode(row.facultyCode);
      if (!id || !code || !facultyCode) {
        return null;
      }

      const applicableDegrees = Array.isArray(row.applicableDegrees)
        ? Array.from(
            new Set(
              row.applicableDegrees
                .map((item) => normalizeAcademicCode(item))
                .filter(Boolean)
            )
          )
        : [];

      return {
        id,
        code,
        facultyCode,
        applicableDegrees,
      } satisfies ModuleEligibilityRecord;
    })
    .filter((row): row is ModuleEligibilityRecord => Boolean(row));
}

export async function validateStaffEligibilityWithDb(input: StaffEligibilityInput) {
  const facultyIds = sanitizeAcademicCodeList(input.facultyIds);
  const degreeProgramIds = sanitizeAcademicCodeList(input.degreeProgramIds);
  const moduleIds = sanitizeModuleIdList(input.moduleIds);

  if (facultyIds.length > 0) {
    const facultyRows = (await FacultyModel.find(
      {
        code: { $in: facultyIds },
        isDeleted: { $ne: true },
      },
      { code: 1 }
    )
      .lean()
      .exec()) as Array<{ code?: unknown }>;

    const validFacultySet = new Set(
      facultyRows.map((row) => normalizeAcademicCode(row.code)).filter(Boolean)
    );

    const invalidFacultyCode = facultyIds.find(
      (facultyId) => !validFacultySet.has(facultyId)
    );
    if (invalidFacultyCode) {
      failValidation(`Invalid faculty selected: ${invalidFacultyCode}`);
    }
  }

  let degreeFacultyMap = new Map<string, string>();
  if (degreeProgramIds.length > 0) {
    const degreeRows = (await DegreeProgramModel.find(
      {
        code: { $in: degreeProgramIds },
        isDeleted: { $ne: true },
      },
      { code: 1, facultyCode: 1 }
    )
      .lean()
      .exec()) as Array<{ code?: unknown; facultyCode?: unknown }>;

    degreeFacultyMap = new Map(
      degreeRows
        .map((row) => [
          normalizeAcademicCode(row.code),
          normalizeAcademicCode(row.facultyCode),
        ])
        .filter((row): row is [string, string] => Boolean(row[0] && row[1]))
    );

    const invalidDegreeCode = degreeProgramIds.find(
      (degreeProgramId) => !degreeFacultyMap.has(degreeProgramId)
    );
    if (invalidDegreeCode) {
      failValidation(`Invalid degree selected: ${invalidDegreeCode}`);
    }

    if (facultyIds.length > 0) {
      const invalidDegreeFaculty = degreeProgramIds.find((degreeProgramId) => {
        const degreeFacultyCode = degreeFacultyMap.get(degreeProgramId);
        if (!degreeFacultyCode) {
          return false;
        }

        return !facultyIds.includes(degreeFacultyCode);
      });

      if (invalidDegreeFaculty) {
        failValidation(
          `Degree ${invalidDegreeFaculty} does not belong to selected faculties`
        );
      }
    }
  }

  const resolvedModuleIds: string[] = [];
  if (moduleIds.length > 0) {
    const moduleRows = await readModuleEligibilityRows(moduleIds);
    const moduleLookup = buildModuleLookupMap(moduleRows);

    for (const moduleId of moduleIds) {
      const moduleRecord = resolveModuleRecord(moduleId, moduleLookup);
      if (!moduleRecord) {
        failValidation(`Invalid module selected: ${moduleId}`);
      }

      if (
        facultyIds.length > 0 &&
        !facultyIds.includes(normalizeAcademicCode(moduleRecord.facultyCode))
      ) {
        failValidation(
          `Module ${moduleId} does not belong to selected faculties`
        );
      }

      if (degreeProgramIds.length > 0) {
        const applicableDegreeSet = new Set(
          moduleRecord.applicableDegrees
            .map((item) => normalizeAcademicCode(item))
            .filter(Boolean)
        );
        const degreeMatch = degreeProgramIds.some((degreeProgramId) =>
          applicableDegreeSet.has(degreeProgramId)
        );
        if (!degreeMatch) {
          failValidation(`Module ${moduleId} does not match selected degrees`);
        }
      }

      resolvedModuleIds.push(moduleRecord.id);
    }
  }

  return {
    facultyIds,
    degreeProgramIds,
    moduleIds: Array.from(new Set(resolvedModuleIds)),
  };
}

import mongoose from "mongoose";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import {
  listModuleOfferings,
  updateModuleOffering,
} from "@/models/module-offering-store";
import {
  normalizeAcademicCode,
  normalizeModuleCode,
  sanitizeId,
  sanitizeIdList,
} from "@/models/module-offering-api";

type LecturerStatus = "ACTIVE" | "INACTIVE";

interface SyncLecturerAssignmentsInput {
  lecturerId: string;
  fullName: string;
  email: string;
  status: LecturerStatus;
  facultyIds: string[];
  degreeProgramIds: string[];
  moduleIds: string[];
}

interface SyncLecturerAssignmentsResult {
  added: number;
  removed: number;
  touchedOfferingIds: string[];
}

function normalizeCodeList(values: string[]) {
  return Array.from(
    new Set(values.map((value) => normalizeAcademicCode(value)).filter(Boolean))
  );
}

function normalizeModuleCandidates(values: string[]) {
  const set = new Set<string>();
  values.forEach((value) => {
    const raw = sanitizeId(value);
    if (!raw) {
      return;
    }
    set.add(raw);
    set.add(raw.toUpperCase());
    const normalizedCode = normalizeModuleCode(raw);
    if (normalizedCode) {
      set.add(normalizedCode);
    }
  });
  return Array.from(set);
}

function normalizeAssigneeSnapshotMap(value: unknown) {
  const map = new Map<string, { name: string; email: string }>();
  if (!Array.isArray(value)) {
    return map;
  }

  value.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const row = item as Record<string, unknown>;
    const lecturerId = sanitizeId(row.lecturerId ?? row.id ?? row._id);
    if (!lecturerId) {
      return;
    }
    map.set(lecturerId, {
      name: String(row.name ?? row.fullName ?? "").trim(),
      email: String(row.email ?? "").trim().toLowerCase(),
    });
  });

  return map;
}

function shouldAssignLecturerToOffering(
  offering: {
    moduleCode?: string;
    moduleId?: string;
  },
  input: {
    status: LecturerStatus;
    moduleIds: string[];
  }
) {
  if (input.status !== "ACTIVE") {
    return false;
  }

  if (input.moduleIds.length === 0) {
    return false;
  }

  const moduleCandidateSet = new Set(
    normalizeModuleCandidates([offering.moduleId ?? "", offering.moduleCode ?? ""])
  );
  if (moduleCandidateSet.size === 0) {
    return false;
  }

  return input.moduleIds.some((moduleId) => moduleCandidateSet.has(moduleId));
}

async function syncInMemoryOfferings(
  input: SyncLecturerAssignmentsInput
): Promise<SyncLecturerAssignmentsResult> {
  const touchedOfferingIds: string[] = [];
  let added = 0;
  let removed = 0;

  const offerings = listModuleOfferings();
  offerings.forEach((offering) => {
    const currentIds = sanitizeIdList(
      offering.assignedLecturerIds ?? offering.assignedLecturers
    );
    const currentlyAssigned = currentIds.includes(input.lecturerId);
    const shouldAssign = shouldAssignLecturerToOffering(offering, input);
    const shouldChange =
      (shouldAssign && !currentlyAssigned) || (!shouldAssign && currentlyAssigned);

    if (!shouldChange) {
      return;
    }

    const nextIds = shouldAssign
      ? [...currentIds, input.lecturerId]
      : currentIds.filter((id) => id !== input.lecturerId);

    const updated = updateModuleOffering(offering.id, {
      assignedLecturerIds: nextIds,
    });
    if (!updated) {
      return;
    }

    touchedOfferingIds.push(updated.id);
    if (shouldAssign) {
      added += 1;
    } else {
      removed += 1;
    }
  });

  return {
    added,
    removed,
    touchedOfferingIds,
  };
}

async function syncMongoOfferings(
  input: SyncLecturerAssignmentsInput
): Promise<SyncLecturerAssignmentsResult> {
  const touchedOfferingIds: string[] = [];
  let added = 0;
  let removed = 0;

  const moduleCandidates = normalizeModuleCandidates(input.moduleIds);

  const scopeQueries: Record<string, unknown>[] = [
    { assignedLecturerIds: input.lecturerId },
  ];

  if (input.status === "ACTIVE" && moduleCandidates.length > 0) {
    scopeQueries.push({
      $or: [
        { moduleId: { $in: moduleCandidates } },
        { moduleCode: { $in: moduleCandidates } },
      ],
    });
  }

  const rows = await ModuleOfferingModel.find({
    $or: scopeQueries,
  }).exec();

  for (const row of rows) {
    const currentIds = sanitizeIdList(
      row.assignedLecturerIds ?? row.assignedLecturers
    );
    const currentlyAssigned = currentIds.includes(input.lecturerId);
    const shouldAssign = shouldAssignLecturerToOffering(
      {
        moduleCode: row.moduleCode,
        moduleId: row.moduleId,
      },
      input
    );
    const shouldChange =
      (shouldAssign && !currentlyAssigned) || (!shouldAssign && currentlyAssigned);

    if (!shouldChange) {
      continue;
    }

    const nextIds = shouldAssign
      ? [...currentIds, input.lecturerId]
      : currentIds.filter((id) => id !== input.lecturerId);

    const snapshotMap = normalizeAssigneeSnapshotMap(row.assignedLecturers);
    const nextSnapshots = nextIds.map((lecturerId) => {
      if (lecturerId === input.lecturerId) {
        return {
          lecturerId,
          name: input.fullName,
          email: input.email,
        };
      }

      const existing = snapshotMap.get(lecturerId);
      return {
        lecturerId,
        name: existing?.name ?? "",
        email: existing?.email ?? "",
      };
    });

    row.assignedLecturerIds = nextIds;
    row.assignedLecturers = nextSnapshots;
    await row.save();

    touchedOfferingIds.push(String(row._id));
    if (shouldAssign) {
      added += 1;
    } else {
      removed += 1;
    }
  }

  return {
    added,
    removed,
    touchedOfferingIds,
  };
}

export async function syncLecturerAssignmentsAcrossModuleOfferings(
  input: SyncLecturerAssignmentsInput,
  options?: { mongooseConnection?: typeof mongoose | null }
) {
  const lecturerId = sanitizeId(input.lecturerId);
  if (!lecturerId) {
    return {
      added: 0,
      removed: 0,
      touchedOfferingIds: [],
    } satisfies SyncLecturerAssignmentsResult;
  }

  const cleanInput: SyncLecturerAssignmentsInput = {
    lecturerId,
    fullName: String(input.fullName ?? "").trim(),
    email: String(input.email ?? "").trim().toLowerCase(),
    status: input.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    facultyIds: normalizeCodeList(input.facultyIds),
    degreeProgramIds: normalizeCodeList(input.degreeProgramIds),
    moduleIds: normalizeModuleCandidates(input.moduleIds),
  };

  const inMemory = await syncInMemoryOfferings(cleanInput);
  if (!options?.mongooseConnection) {
    return inMemory;
  }

  const mongo = await syncMongoOfferings(cleanInput);
  return {
    added: inMemory.added + mongo.added,
    removed: inMemory.removed + mongo.removed,
    touchedOfferingIds: Array.from(
      new Set([...inMemory.touchedOfferingIds, ...mongo.touchedOfferingIds])
    ),
  } satisfies SyncLecturerAssignmentsResult;
}

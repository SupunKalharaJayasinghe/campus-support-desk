import mongoose from "mongoose";
import { LecturerModel } from "@/models/Lecturer";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { listModuleOfferings } from "@/models/module-offering-store";
import {
  findLecturerInMemoryById,
  sanitizeModuleIdList,
  updateLecturerInMemory,
} from "@/models/lecturer-store";
import { normalizeModuleCode, sanitizeId, sanitizeIdList } from "@/models/module-offering-api";

interface OfferingLecturerLinkState {
  offeringId?: string;
  moduleCode?: string;
  moduleId?: string;
  lecturerIds?: string[];
}

interface SyncLecturerModuleLinksForOfferingMutationInput {
  previous?: OfferingLecturerLinkState | null;
  next?: OfferingLecturerLinkState | null;
  mongooseConnection?: typeof mongoose | null;
}

function primaryModuleToken(state?: OfferingLecturerLinkState | null) {
  if (!state) {
    return "";
  }

  return normalizeModuleCode(state.moduleCode) || sanitizeId(state.moduleId);
}

function moduleTokenCandidates(state?: OfferingLecturerLinkState | null) {
  const set = new Set<string>();
  if (!state) {
    return set;
  }

  const moduleId = sanitizeId(state.moduleId);
  const moduleCode = normalizeModuleCode(state.moduleCode);
  if (moduleId) {
    set.add(moduleId);
    set.add(moduleId.toUpperCase());
  }
  if (moduleCode) {
    set.add(moduleCode);
  }
  return set;
}

function normalizeLecturerIds(state?: OfferingLecturerLinkState | null) {
  return new Set(sanitizeIdList(state?.lecturerIds));
}

function removeModuleTokens(moduleIds: string[], candidates: Set<string>) {
  if (candidates.size === 0) {
    return sanitizeModuleIdList(moduleIds);
  }

  const candidateUpper = new Set(Array.from(candidates).map((item) => item.toUpperCase()));
  return sanitizeModuleIdList(moduleIds).filter((item) => {
    const raw = sanitizeId(item);
    if (!raw) {
      return false;
    }
    return !candidates.has(raw) && !candidateUpper.has(raw.toUpperCase());
  });
}

function addModuleToken(moduleIds: string[], token: string) {
  const clean = sanitizeId(token);
  if (!clean) {
    return sanitizeModuleIdList(moduleIds);
  }
  return sanitizeModuleIdList([...moduleIds, clean]);
}

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

function hasTokenOverlap(
  leftCandidates: Set<string>,
  rightCandidates: Set<string>
) {
  if (leftCandidates.size === 0 || rightCandidates.size === 0) {
    return false;
  }

  const rightUpper = new Set(Array.from(rightCandidates).map((item) => item.toUpperCase()));
  for (const item of leftCandidates) {
    if (rightCandidates.has(item) || rightUpper.has(item.toUpperCase())) {
      return true;
    }
  }

  return false;
}

async function hasInMemoryAssignmentForModule(
  lecturerId: string,
  moduleCandidates: Set<string>,
  excludeOfferingId?: string
) {
  if (!lecturerId || moduleCandidates.size === 0) {
    return false;
  }

  const excludeId = sanitizeId(excludeOfferingId);
  const offerings = listModuleOfferings();
  return offerings.some((offering) => {
    if (excludeId && offering.id === excludeId) {
      return false;
    }
    if (!sanitizeIdList(offering.assignedLecturerIds).includes(lecturerId)) {
      return false;
    }

    const offeringCandidates = moduleTokenCandidates({
      moduleCode: offering.moduleCode,
      moduleId: offering.moduleId,
    });
    return hasTokenOverlap(offeringCandidates, moduleCandidates);
  });
}

async function hasMongoAssignmentForModule(
  lecturerId: string,
  moduleCandidates: Set<string>,
  excludeOfferingId?: string
) {
  if (!lecturerId || moduleCandidates.size === 0) {
    return false;
  }

  const query: Record<string, unknown> = {
    assignedLecturerIds: lecturerId,
    $or: [
      { moduleId: { $in: Array.from(moduleCandidates) } },
      { moduleCode: { $in: Array.from(moduleCandidates) } },
    ],
  };

  const excludeId = sanitizeId(excludeOfferingId);
  if (excludeId) {
    query._id = mongoose.Types.ObjectId.isValid(excludeId)
      ? { $ne: new mongoose.Types.ObjectId(excludeId) }
      : { $ne: excludeId };
  }

  return Boolean(await ModuleOfferingModel.exists(query).catch(() => null));
}

async function updateInMemoryLecturerModuleIds(lecturerId: string, nextModuleIds: string[]) {
  const row = findLecturerInMemoryById(lecturerId);
  if (!row) {
    return;
  }

  const current = sanitizeModuleIdList(row.moduleIds);
  const next = sanitizeModuleIdList(nextModuleIds);
  if (sameStringSet(current, next)) {
    return;
  }

  updateLecturerInMemory({
    id: row.id,
    fullName: row.fullName,
    optionalEmail: row.optionalEmail,
    phone: row.phone,
    nicStaffId: row.nicStaffId,
    status: row.status,
    facultyIds: row.facultyIds,
    degreeProgramIds: row.degreeProgramIds,
    moduleIds: next,
  });
}

async function updateMongoLecturerModuleIds(lecturerId: string, nextModuleIds: string[]) {
  if (!mongoose.Types.ObjectId.isValid(lecturerId)) {
    return;
  }

  const row = await LecturerModel.findById(lecturerId).exec();
  if (!row) {
    return;
  }

  const current = sanitizeModuleIdList(row.moduleIds);
  const next = sanitizeModuleIdList(nextModuleIds);
  if (sameStringSet(current, next)) {
    return;
  }

  row.moduleIds = next;
  await row.save();
}

export async function syncLecturerModuleLinksForOfferingMutation(
  input: SyncLecturerModuleLinksForOfferingMutationInput
) {
  const previousLecturerIds = normalizeLecturerIds(input.previous);
  const nextLecturerIds = normalizeLecturerIds(input.next);
  const previousModuleCandidates = moduleTokenCandidates(input.previous);
  const nextPrimaryModuleToken = primaryModuleToken(input.next);
  const previousPrimaryModuleToken = primaryModuleToken(input.previous);
  const shouldRemovePreviousForCommonLecturers =
    Boolean(previousPrimaryModuleToken) &&
    previousPrimaryModuleToken !== nextPrimaryModuleToken;
  const previousOfferingId = sanitizeId(input.previous?.offeringId);

  const affectedLecturerIds = new Set<string>([
    ...previousLecturerIds,
    ...nextLecturerIds,
  ]);

  for (const lecturerId of affectedLecturerIds) {
    const lecturerKey = sanitizeId(lecturerId);
    if (!lecturerKey) {
      continue;
    }

    const existsInPrevious = previousLecturerIds.has(lecturerKey);
    const existsInNext = nextLecturerIds.has(lecturerKey);

    const memoryRow = findLecturerInMemoryById(lecturerKey);
    let currentModuleIds = sanitizeModuleIdList(memoryRow?.moduleIds);
    if (existsInPrevious && (!existsInNext || shouldRemovePreviousForCommonLecturers)) {
      const hasOtherAssignments = await hasInMemoryAssignmentForModule(
        lecturerKey,
        previousModuleCandidates,
        previousOfferingId
      );
      if (!hasOtherAssignments) {
        currentModuleIds = removeModuleTokens(currentModuleIds, previousModuleCandidates);
      }
    }
    if (existsInNext && nextPrimaryModuleToken) {
      currentModuleIds = addModuleToken(currentModuleIds, nextPrimaryModuleToken);
    }
    await updateInMemoryLecturerModuleIds(lecturerKey, currentModuleIds);

    if (!input.mongooseConnection) {
      continue;
    }

    const mongoRow = mongoose.Types.ObjectId.isValid(lecturerKey)
      ? await LecturerModel.findById(lecturerKey).lean().exec().catch(() => null)
      : null;
    const mongoModuleIds = sanitizeModuleIdList(
      (mongoRow as { moduleIds?: string[] } | null)?.moduleIds
    );
    let nextMongoModuleIds = mongoModuleIds;
    if (existsInPrevious && (!existsInNext || shouldRemovePreviousForCommonLecturers)) {
      const hasOtherAssignments = await hasMongoAssignmentForModule(
        lecturerKey,
        previousModuleCandidates,
        previousOfferingId
      );
      if (!hasOtherAssignments) {
        nextMongoModuleIds = removeModuleTokens(nextMongoModuleIds, previousModuleCandidates);
      }
    }
    if (existsInNext && nextPrimaryModuleToken) {
      nextMongoModuleIds = addModuleToken(nextMongoModuleIds, nextPrimaryModuleToken);
    }
    await updateMongoLecturerModuleIds(lecturerKey, nextMongoModuleIds);
  }
}

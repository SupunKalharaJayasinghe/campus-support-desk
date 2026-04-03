import mongoose from "mongoose";
import { LabAssistantModel } from "@/models/LabAssistant";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { listModuleOfferings } from "@/models/module-offering-store";
import {
  findLabAssistantInMemoryById,
  sanitizeModuleIdList,
  updateLabAssistantInMemory,
} from "@/models/lab-assistant-store";
import { normalizeModuleCode, sanitizeId, sanitizeIdList } from "@/models/module-offering-api";

interface OfferingLabAssistantLinkState {
  offeringId?: string;
  moduleCode?: string;
  moduleId?: string;
  labAssistantIds?: string[];
}

interface SyncLabAssistantModuleLinksForOfferingMutationInput {
  previous?: OfferingLabAssistantLinkState | null;
  next?: OfferingLabAssistantLinkState | null;
  mongooseConnection?: typeof mongoose | null;
}

function primaryModuleToken(state?: OfferingLabAssistantLinkState | null) {
  if (!state) {
    return "";
  }

  return sanitizeId(state.moduleId) || normalizeModuleCode(state.moduleCode);
}

function moduleTokenCandidates(state?: OfferingLabAssistantLinkState | null) {
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

function normalizeLabAssistantIds(state?: OfferingLabAssistantLinkState | null) {
  return new Set(sanitizeIdList(state?.labAssistantIds));
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
  labAssistantId: string,
  moduleCandidates: Set<string>,
  excludeOfferingId?: string
) {
  if (!labAssistantId || moduleCandidates.size === 0) {
    return false;
  }

  const excludeId = sanitizeId(excludeOfferingId);
  const offerings = listModuleOfferings();
  return offerings.some((offering) => {
    if (excludeId && offering.id === excludeId) {
      return false;
    }
    const assignedIds = sanitizeIdList(offering.assignedLabAssistantIds);
    if (!assignedIds.includes(labAssistantId)) {
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
  labAssistantId: string,
  moduleCandidates: Set<string>,
  excludeOfferingId?: string
) {
  if (!labAssistantId || moduleCandidates.size === 0) {
    return false;
  }

  const moduleCandidateValues = Array.from(moduleCandidates);
  const query: Record<string, unknown> = {
    $and: [
      {
        $or: [
          { assignedLabAssistantIds: labAssistantId },
          { assignedLabAssistants: labAssistantId },
          { "assignedLabAssistants.assistantId": labAssistantId },
          { "assignedLabAssistants.id": labAssistantId },
          { "assignedLabAssistants._id": labAssistantId },
        ],
      },
      {
        $or: [
          { moduleId: { $in: moduleCandidateValues } },
          { moduleCode: { $in: moduleCandidateValues } },
        ],
      },
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

async function updateInMemoryLabAssistantModuleIds(
  labAssistantId: string,
  nextModuleIds: string[]
) {
  const row = findLabAssistantInMemoryById(labAssistantId);
  if (!row) {
    return;
  }

  const current = sanitizeModuleIdList(row.moduleIds);
  const next = sanitizeModuleIdList(nextModuleIds);
  if (sameStringSet(current, next)) {
    return;
  }

  updateLabAssistantInMemory({
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

async function updateMongoLabAssistantModuleIds(
  labAssistantId: string,
  nextModuleIds: string[]
) {
  if (!mongoose.Types.ObjectId.isValid(labAssistantId)) {
    return;
  }

  const row = await LabAssistantModel.findById(labAssistantId).exec();
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

export async function syncLabAssistantModuleLinksForOfferingMutation(
  input: SyncLabAssistantModuleLinksForOfferingMutationInput
) {
  const previousLabAssistantIds = normalizeLabAssistantIds(input.previous);
  const nextLabAssistantIds = normalizeLabAssistantIds(input.next);
  const previousModuleCandidates = moduleTokenCandidates(input.previous);
  const nextPrimaryModuleToken = primaryModuleToken(input.next);
  const previousPrimaryModuleToken = primaryModuleToken(input.previous);
  const shouldRemovePreviousForCommonLabAssistants =
    Boolean(previousPrimaryModuleToken) &&
    previousPrimaryModuleToken !== nextPrimaryModuleToken;
  const previousOfferingId = sanitizeId(input.previous?.offeringId);

  const affectedLabAssistantIds = new Set<string>([
    ...previousLabAssistantIds,
    ...nextLabAssistantIds,
  ]);

  for (const labAssistantId of affectedLabAssistantIds) {
    const labAssistantKey = sanitizeId(labAssistantId);
    if (!labAssistantKey) {
      continue;
    }

    const existsInPrevious = previousLabAssistantIds.has(labAssistantKey);
    const existsInNext = nextLabAssistantIds.has(labAssistantKey);

    const memoryRow = findLabAssistantInMemoryById(labAssistantKey);
    let currentModuleIds = sanitizeModuleIdList(memoryRow?.moduleIds);
    if (
      existsInPrevious &&
      (!existsInNext || shouldRemovePreviousForCommonLabAssistants)
    ) {
      const hasOtherAssignments = await hasInMemoryAssignmentForModule(
        labAssistantKey,
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
    await updateInMemoryLabAssistantModuleIds(labAssistantKey, currentModuleIds);

    if (!input.mongooseConnection) {
      continue;
    }

    const mongoRow = mongoose.Types.ObjectId.isValid(labAssistantKey)
      ? await LabAssistantModel.findById(labAssistantKey).lean().exec().catch(() => null)
      : null;
    const mongoModuleIds = sanitizeModuleIdList(
      (mongoRow as { moduleIds?: string[] } | null)?.moduleIds
    );
    let nextMongoModuleIds = mongoModuleIds;
    if (
      existsInPrevious &&
      (!existsInNext || shouldRemovePreviousForCommonLabAssistants)
    ) {
      const hasOtherAssignments = await hasMongoAssignmentForModule(
        labAssistantKey,
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
    await updateMongoLabAssistantModuleIds(labAssistantKey, nextMongoModuleIds);
  }
}

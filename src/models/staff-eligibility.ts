export interface OfferingEligibilityScope {
  facultyCode?: string;
  degreeCode?: string;
  moduleCode?: string;
  moduleId?: string;
  // Legacy aliases used by older callsites.
  facultyId?: string;
  degreeProgramId?: string;
}

export interface StaffEligibilityRecord {
  facultyIds: string[];
  degreeProgramIds: string[];
  moduleIds: string[];
}

export function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

export function sanitizeId(value: unknown) {
  return String(value ?? "").trim();
}

function moduleCandidates(scope: OfferingEligibilityScope) {
  const rawValues = [
    sanitizeId(scope.moduleCode),
    sanitizeId(scope.moduleId),
  ].filter(Boolean);

  const values = new Set<string>();
  rawValues.forEach((value) => {
    values.add(value);
    values.add(value.toUpperCase());
  });

  return Array.from(values).filter(Boolean);
}

function moduleEligibilitySet(values: string[]) {
  const set = new Set<string>();
  values.forEach((value) => {
    const normalized = sanitizeId(value);
    if (!normalized) {
      return;
    }
    set.add(normalized);
    set.add(normalized.toUpperCase());
  });
  return set;
}

export function isStaffEligibleForOffering(
  row: StaffEligibilityRecord,
  scope: OfferingEligibilityScope
) {
  const facultyCode = normalizeAcademicCode(scope.facultyCode ?? scope.facultyId);
  const degreeCode = normalizeAcademicCode(scope.degreeCode ?? scope.degreeProgramId);
  const moduleScopeCandidates = moduleCandidates(scope);
  if (!facultyCode || !degreeCode || moduleScopeCandidates.length === 0) {
    return false;
  }

  const moduleSet = moduleEligibilitySet(row.moduleIds);
  const hasModuleMatch = moduleScopeCandidates.some((value) => moduleSet.has(value));

  return (
    row.facultyIds.includes(facultyCode) &&
    row.degreeProgramIds.includes(degreeCode) &&
    hasModuleMatch
  );
}

export function staffEligibilityMongoFilter(scope: OfferingEligibilityScope) {
  const facultyCode = normalizeAcademicCode(scope.facultyCode ?? scope.facultyId);
  const degreeCode = normalizeAcademicCode(scope.degreeCode ?? scope.degreeProgramId);
  const candidates = moduleCandidates(scope);

  return {
    status: "ACTIVE",
    facultyIds: facultyCode,
    degreeProgramIds: degreeCode,
    moduleIds:
      candidates.length <= 1
        ? candidates[0] ?? "__no-module-match__"
        : { $in: candidates },
  };
}

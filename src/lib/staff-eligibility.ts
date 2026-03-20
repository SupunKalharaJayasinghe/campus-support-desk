export interface OfferingEligibilityScope {
  facultyId: string;
  degreeProgramId: string;
  moduleId: string;
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

export function isStaffEligibleForOffering(
  row: StaffEligibilityRecord,
  scope: OfferingEligibilityScope
) {
  const facultyId = normalizeAcademicCode(scope.facultyId);
  const degreeProgramId = normalizeAcademicCode(scope.degreeProgramId);
  const moduleId = sanitizeId(scope.moduleId);
  if (!facultyId || !degreeProgramId || !moduleId) {
    return false;
  }

  return (
    row.facultyIds.includes(facultyId) &&
    row.degreeProgramIds.includes(degreeProgramId) &&
    row.moduleIds.includes(moduleId)
  );
}

export function staffEligibilityMongoFilter(scope: OfferingEligibilityScope) {
  return {
    status: "ACTIVE",
    facultyIds: normalizeAcademicCode(scope.facultyId),
    degreeProgramIds: normalizeAcademicCode(scope.degreeProgramId),
    moduleIds: sanitizeId(scope.moduleId),
  };
}

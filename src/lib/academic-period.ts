function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function buildAcademicYear(startYear: number) {
  return `${startYear}/${startYear + 1}`;
}

function parseIntakeStartYear(value: unknown) {
  const input = collapseSpaces(value);
  const match = input.match(/\b(19|20)\d{2}\b/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTermCodeDetails(value: unknown) {
  const input = collapseSpaces(value).toUpperCase();
  const match = input.match(/^Y(\d+)S([12])$/);
  if (!match) {
    return null;
  }

  const yearLevel = Number(match[1]);
  const semester = Number(match[2]);
  if (!Number.isFinite(yearLevel) || yearLevel < 1) {
    return null;
  }

  return {
    yearLevel,
    semester: semester === 1 || semester === 2 ? (semester as 1 | 2) : null,
  };
}

export interface DerivedAcademicPeriod {
  academicYear: string;
  semester: 1 | 2 | null;
  yearLevel: number | null;
}

export function deriveAcademicPeriodFromOffering(input: {
  intakeName?: unknown;
  termCode?: unknown;
}): DerivedAcademicPeriod {
  const intakeStartYear = parseIntakeStartYear(input.intakeName);
  const termDetails = parseTermCodeDetails(input.termCode);

  if (!intakeStartYear || !termDetails?.semester) {
    return {
      academicYear: "",
      semester: termDetails?.semester ?? null,
      yearLevel: termDetails?.yearLevel ?? null,
    };
  }

  const academicYearStart = intakeStartYear + termDetails.yearLevel - 1;

  return {
    academicYear: buildAcademicYear(academicYearStart),
    semester: termDetails.semester,
    yearLevel: termDetails.yearLevel,
  };
}

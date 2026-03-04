"use client";

import type { Dispatch, SetStateAction } from "react";
import { createContext, useContext, useMemo, useState } from "react";

export type FacultyCode = "FOC" | "FOE" | "FOB" | "FOS";
export type DegreeCode = "SE" | "CS" | "IT" | "CE" | "EE" | "BIZ" | "FIN" | "BIO";
export type TermCode =
  | "Y1S1"
  | "Y1S2"
  | "Y2S1"
  | "Y2S2"
  | "Y3S1"
  | "Y3S2"
  | "Y4S1"
  | "Y4S2";

export type StreamType = "Weekday" | "Weekend";

export interface FacultyOption {
  code: FacultyCode;
  label: string;
}

export interface DegreeOption {
  code: DegreeCode;
  label: string;
}

export interface AdminScope {
  faculty: FacultyCode;
  degree: DegreeCode;
  intake: string;
  term: TermCode;
  stream: StreamType;
  subgroup: string;
}

export const FACULTIES: FacultyOption[] = [
  { code: "FOC", label: "Faculty of Computing" },
  { code: "FOE", label: "Faculty of Engineering" },
  { code: "FOB", label: "Faculty of Business" },
  { code: "FOS", label: "Faculty of Science" },
];

export const DEGREES_BY_FACULTY: Record<FacultyCode, DegreeOption[]> = {
  FOC: [
    { code: "SE", label: "BSc Software Engineering" },
    { code: "CS", label: "BSc Computer Science" },
    { code: "IT", label: "BSc Information Technology" },
  ],
  FOE: [
    { code: "CE", label: "BEng Civil Engineering" },
    { code: "EE", label: "BEng Electrical Engineering" },
  ],
  FOB: [
    { code: "BIZ", label: "BBA Business Administration" },
    { code: "FIN", label: "BSc Finance" },
  ],
  FOS: [{ code: "BIO", label: "BSc Biomedical Science" }],
};

export const INTAKES_BY_DEGREE: Partial<Record<DegreeCode, string[]>> = {
  SE: ["2026 June", "2026 October", "2027 February"],
  CS: ["2026 June", "2027 February"],
  IT: ["2026 October", "2027 February"],
  CE: ["2026 June"],
  EE: ["2026 October"],
  BIZ: ["2026 June", "2026 October"],
  FIN: ["2026 June"],
  BIO: ["2026 October"],
};

export const TERM_OPTIONS: TermCode[] = [
  "Y1S1",
  "Y1S2",
  "Y2S1",
  "Y2S2",
  "Y3S1",
  "Y3S2",
  "Y4S1",
  "Y4S2",
];

export const STREAM_OPTIONS: StreamType[] = ["Weekday", "Weekend"];

export const SUBGROUP_OPTIONS = ["1.1", "1.2", "1.3", "2.1", "2.2", "3.1"];

const DEFAULT_SCOPE: AdminScope = {
  faculty: "FOC",
  degree: "SE",
  intake: "2026 June",
  term: "Y1S1",
  stream: "Weekday",
  subgroup: "1.1",
};

interface AdminContextValue {
  scope: AdminScope;
  activeWindow: string | null;
  setActiveWindow: Dispatch<SetStateAction<string | null>>;
  setFaculty: (faculty: FacultyCode) => void;
  setDegree: (degree: DegreeCode) => void;
  setIntake: (intake: string) => void;
  setTerm: (term: TermCode) => void;
  setStream: (stream: StreamType) => void;
  setSubgroup: (subgroup: string) => void;
  degrees: DegreeOption[];
  intakes: string[];
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminContextProvider({ children }: { children: React.ReactNode }) {
  const [scope, setScope] = useState<AdminScope>(DEFAULT_SCOPE);
  const [activeWindow, setActiveWindow] = useState<string | null>(null);

  const degrees = useMemo(() => DEGREES_BY_FACULTY[scope.faculty], [scope.faculty]);

  const intakes = useMemo(() => {
    const list = INTAKES_BY_DEGREE[scope.degree] ?? [];
    return list.length ? list : [DEFAULT_SCOPE.intake];
  }, [scope.degree]);

  const setFaculty = (faculty: FacultyCode) => {
    const nextDegrees = DEGREES_BY_FACULTY[faculty];
    const nextDegree = nextDegrees[0]?.code ?? scope.degree;
    const nextIntakes = INTAKES_BY_DEGREE[nextDegree] ?? [];
    const nextIntake = nextIntakes[0] ?? DEFAULT_SCOPE.intake;
    setScope((previous) => ({
      ...previous,
      faculty,
      degree: nextDegree,
      intake: nextIntake,
    }));
  };

  const setDegree = (degree: DegreeCode) => {
    const nextIntakes = INTAKES_BY_DEGREE[degree] ?? [];
    const nextIntake = nextIntakes[0] ?? DEFAULT_SCOPE.intake;
    setScope((previous) => ({ ...previous, degree, intake: nextIntake }));
  };

  const value: AdminContextValue = {
    scope,
    activeWindow,
    setActiveWindow,
    degrees,
    intakes,
    setFaculty,
    setDegree,
    setIntake: (intake) => setScope((previous) => ({ ...previous, intake })),
    setTerm: (term) => setScope((previous) => ({ ...previous, term })),
    setStream: (stream) => setScope((previous) => ({ ...previous, stream })),
    setSubgroup: (subgroup) => setScope((previous) => ({ ...previous, subgroup })),
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdminContext() {
  const value = useContext(AdminContext);
  if (!value) {
    throw new Error("useAdminContext must be used within AdminContextProvider");
  }
  return value;
}

export function labelForFaculty(code: FacultyCode) {
  return FACULTIES.find((item) => item.code === code)?.label ?? code;
}

export function labelForDegree(faculty: FacultyCode, degree: DegreeCode) {
  return DEGREES_BY_FACULTY[faculty].find((item) => item.code === degree)?.label ?? degree;
}

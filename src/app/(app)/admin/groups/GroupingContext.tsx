"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type StudentTrack = "weekday" | "weekend" | "unassigned";

export interface GroupingStudent {
  id: string;
  name: string;
  campusId: string;
  email: string;
  faculty: string;
  degreeProgram: string;
  year: number;
  semester: number;
  track: StudentTrack;
  group?: string;
}

interface GroupingContextValue {
  students: GroupingStudent[];
  groupOptions: string[];
  faculties: string[];
  degreePrograms: string[];
  years: number[];
  semesters: number[];
  assignStudentsToTrack: (
    studentIds: string[],
    targetTrack: Exclude<StudentTrack, "unassigned">
  ) => number;
  assignStudentToGroup: (studentId: string, group: string | null) => boolean;
}

const GroupingContext = createContext<GroupingContextValue | null>(null);

const GROUP_OPTIONS = ["Group 2.1", "Group 2.2", "Group 3.1", "Group 3.2", "Group 3.3"];

const INITIAL_STUDENTS: GroupingStudent[] = [
  {
    id: "stu-001",
    name: "Ayesha Perera",
    campusId: "IT23014512",
    email: "ayesha.perera@campus.edu",
    faculty: "Faculty of Computing",
    degreeProgram: "BSc Computer Science",
    year: 3,
    semester: 1,
    track: "weekday",
    group: "Group 3.1",
  },
  {
    id: "stu-002",
    name: "Nuwan Silva",
    campusId: "IT23014522",
    email: "nuwan.silva@campus.edu",
    faculty: "Faculty of Computing",
    degreeProgram: "BSc Computer Science",
    year: 3,
    semester: 1,
    track: "unassigned",
  },
  {
    id: "stu-003",
    name: "Tharushi Fernando",
    campusId: "IT23014539",
    email: "tharushi.fernando@campus.edu",
    faculty: "Faculty of Computing",
    degreeProgram: "BSc Computer Science",
    year: 3,
    semester: 2,
    track: "weekend",
    group: "Group 3.2",
  },
  {
    id: "stu-004",
    name: "Imesha Jayasekara",
    campusId: "IT23014540",
    email: "imesha.jayasekara@campus.edu",
    faculty: "Faculty of Computing",
    degreeProgram: "BSc Software Engineering",
    year: 3,
    semester: 1,
    track: "unassigned",
  },
  {
    id: "stu-005",
    name: "Kasun Rodrigo",
    campusId: "SE23017421",
    email: "kasun.rodrigo@campus.edu",
    faculty: "Faculty of Computing",
    degreeProgram: "BSc Software Engineering",
    year: 3,
    semester: 2,
    track: "weekday",
    group: "Group 3.3",
  },
  {
    id: "stu-006",
    name: "Dinithi Samarasinghe",
    campusId: "SE23017447",
    email: "dinithi.samarasinghe@campus.edu",
    faculty: "Faculty of Computing",
    degreeProgram: "BSc Software Engineering",
    year: 2,
    semester: 2,
    track: "weekend",
    group: "Group 2.2",
  },
  {
    id: "stu-007",
    name: "Ravindu Madushan",
    campusId: "ME24012104",
    email: "ravindu.madushan@campus.edu",
    faculty: "Faculty of Engineering",
    degreeProgram: "BEng Mechanical Engineering",
    year: 2,
    semester: 1,
    track: "weekday",
    group: "Group 2.1",
  },
  {
    id: "stu-008",
    name: "Ishani Wickramage",
    campusId: "ME24012118",
    email: "ishani.wickramage@campus.edu",
    faculty: "Faculty of Engineering",
    degreeProgram: "BEng Mechanical Engineering",
    year: 2,
    semester: 2,
    track: "unassigned",
  },
  {
    id: "stu-009",
    name: "Chanaka Weerasinghe",
    campusId: "EE24011802",
    email: "chanaka.weerasinghe@campus.edu",
    faculty: "Faculty of Engineering",
    degreeProgram: "BEng Electrical Engineering",
    year: 2,
    semester: 1,
    track: "weekday",
    group: "Group 2.1",
  },
  {
    id: "stu-010",
    name: "Lakshani Gunasekara",
    campusId: "EE24011811",
    email: "lakshani.gunasekara@campus.edu",
    faculty: "Faculty of Engineering",
    degreeProgram: "BEng Electrical Engineering",
    year: 2,
    semester: 2,
    track: "weekend",
    group: "Group 2.2",
  },
  {
    id: "stu-011",
    name: "Malith Jayawardena",
    campusId: "IT24013402",
    email: "malith.jayawardena@campus.edu",
    faculty: "Faculty of Computing",
    degreeProgram: "BSc Computer Science",
    year: 2,
    semester: 1,
    track: "unassigned",
  },
  {
    id: "stu-012",
    name: "Shenali Fernando",
    campusId: "IT24013415",
    email: "shenali.fernando@campus.edu",
    faculty: "Faculty of Computing",
    degreeProgram: "BSc Computer Science",
    year: 2,
    semester: 2,
    track: "unassigned",
  },
];

export function GroupingProvider({ children }: { children: React.ReactNode }) {
  const [students, setStudents] = useState<GroupingStudent[]>(INITIAL_STUDENTS);

  const faculties = useMemo(
    () => Array.from(new Set(students.map((student) => student.faculty))).sort(),
    [students]
  );
  const degreePrograms = useMemo(
    () => Array.from(new Set(students.map((student) => student.degreeProgram))).sort(),
    [students]
  );
  const years = useMemo(
    () =>
      Array.from(new Set(students.map((student) => student.year))).sort(
        (a, b) => a - b
      ),
    [students]
  );
  const semesters = useMemo(
    () =>
      Array.from(new Set(students.map((student) => student.semester))).sort(
        (a, b) => a - b
      ),
    [students]
  );

  const assignStudentsToTrack = (
    studentIds: string[],
    targetTrack: Exclude<StudentTrack, "unassigned">
  ) => {
    const idSet = new Set(studentIds);
    let updatedCount = 0;

    setStudents((previous) =>
      previous.map((student) => {
        if (!idSet.has(student.id)) {
          return student;
        }
        updatedCount += 1;
        return { ...student, track: targetTrack };
      })
    );

    return updatedCount;
  };

  const assignStudentToGroup = (studentId: string, group: string | null) => {
    let updated = false;
    setStudents((previous) =>
      previous.map((student) => {
        if (student.id !== studentId) {
          return student;
        }

        const nextGroup = group ?? undefined;
        if (student.group === nextGroup) {
          return student;
        }

        updated = true;
        return { ...student, group: nextGroup };
      })
    );

    return updated;
  };

  const value: GroupingContextValue = {
    students,
    groupOptions: GROUP_OPTIONS,
    faculties,
    degreePrograms,
    years,
    semesters,
    assignStudentsToTrack,
    assignStudentToGroup,
  };

  return <GroupingContext.Provider value={value}>{children}</GroupingContext.Provider>;
}

export function useGrouping() {
  const context = useContext(GroupingContext);
  if (!context) {
    throw new Error("useGrouping must be used within GroupingProvider.");
  }
  return context;
}

import { expect, test, type Page, type Route } from "@playwright/test";
import {
  getCurrentLevel,
  getLevelBadge,
  getLevelComparison,
  getLevelProgress,
  getNextLevel,
} from "../src/models/level-utils";

test.setTimeout(90_000);

const ROLE_STORAGE_KEY = "unihub_role";
const USER_STORAGE_KEY = "unihub_user";
const STUDENT_ID = "507f1f77bcf86cd7994390aa";
const REGISTRATION_NUMBER = "TG2022/1234";

type ScopeKey = "campus" | "faculty" | "degree" | "intake";
type PointsCategory =
  | "academic"
  | "quiz"
  | "assignment"
  | "milestone"
  | "bonus"
  | "penalty"
  | "custom";
type TrophyTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";
type TrophyCategory =
  | "academic"
  | "score"
  | "gpa"
  | "semester"
  | "milestone"
  | "level"
  | "special"
  | "custom";

interface StudentEnrollment {
  id: string;
  facultyId: string;
  facultyName: string;
  degreeProgramId: string;
  degreeProgramName: string;
  intakeId: string;
  intakeName: string;
  currentTerm: string;
  stream: string;
  subgroup: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface StudentRecord {
  id: string;
  studentId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  status: string;
  enrollmentCount: number;
  latestEnrollment: StudentEnrollment;
  enrollments: StudentEnrollment[];
}

interface RecentActivityItem {
  action: string;
  xpPoints: number;
  reason: string;
  category: PointsCategory;
  createdAt: string;
  metadata: Record<string, unknown>;
}

interface TrophyItem {
  definition: {
    key: string;
    name: string;
    description: string;
    icon: string;
    tier: TrophyTier;
    category: TrophyCategory;
    condition: string;
    xpBonus: number;
  };
  earned: boolean;
  earnedAt: string | null;
  metadata: Record<string, unknown> | null;
}

interface LeaderboardEntry {
  rank: number;
  student: {
    id: string;
    name: string;
    registrationNumber: string;
    faculty?: string;
    degreeProgram?: string;
    intake?: string;
  };
  totalXP: number;
  level: ReturnType<typeof getCurrentLevel>;
  topTrophy: {
    key: string;
    name: string;
    icon: string;
    tier: string;
  } | null;
  xpChange: {
    last7Days: number;
    last30Days: number;
  };
}

const enrollment: StudentEnrollment = {
  id: "enrollment-1",
  facultyId: "FOC",
  facultyName: "Faculty of Computing",
  degreeProgramId: "SE",
  degreeProgramName: "Software Engineering",
  intakeId: "INT-2022-A",
  intakeName: "2022 Intake A",
  currentTerm: "Y2S2",
  stream: "Main",
  subgroup: "SE-G1",
  status: "ACTIVE",
  createdAt: "2025-01-10T08:00:00.000Z",
  updatedAt: "2026-04-20T09:30:00.000Z",
};

const studentRecord: StudentRecord = {
  id: STUDENT_ID,
  studentId: REGISTRATION_NUMBER,
  email: "nimali.perera@example.edu",
  firstName: "Nimali",
  lastName: "Perera",
  fullName: "Nimali Perera",
  phone: "0771234567",
  status: "ACTIVE",
  enrollmentCount: 1,
  latestEnrollment: enrollment,
  enrollments: [enrollment],
};

const studentSessionUser = {
  id: STUDENT_ID,
  studentRef: STUDENT_ID,
  name: "Nimali Perera",
  role: "STUDENT" as const,
  userRole: "STUDENT",
  username: REGISTRATION_NUMBER,
  studentRegistrationNumber: REGISTRATION_NUMBER,
  email: "nimali.perera@example.edu",
  mustChangePassword: false,
};

const performancePayload = {
  success: true,
  data: {
    student: {
      id: STUDENT_ID,
      name: "Nimali Perera",
      registrationNumber: REGISTRATION_NUMBER,
      firstName: "Nimali",
      lastName: "Perera",
      email: "nimali.perera@example.edu",
      phone: "0771234567",
      status: "ACTIVE",
    },
    overview: {
      cumulativeGPA: 3.18,
      classification: "Second Upper",
      academicStanding: {
        standing: "Academic Warning",
        level: "warning",
        color: "amber",
        message: "A few modules need intervention before the next review cycle.",
        recommendations: [
          "Prioritize repeat and pro-rata modules first.",
          "Meet your academic advisor within this month.",
          "Focus on final-exam preparation for weak modules.",
        ],
      },
      totalModulesTaken: 5,
      totalModulesPassed: 2,
      totalModulesFailed: 3,
      totalProRata: 1,
      totalRepeat: 1,
      totalCreditsCompleted: 24,
      totalCreditsRequired: 120,
      progressPercentage: 20,
      trend: "improving",
    },
    semesterBreakdown: [
      {
        academicYear: "2025/2026",
        semester: 1,
        semesterGPA: 3.65,
        modules: [
          {
            gradeId: "grade-1",
            moduleCode: "SE201",
            moduleName: "Software Design",
            caMarks: 35,
            finalExamMarks: 50,
            totalMarks: 85,
            gradeLetter: "A",
            gradePoint: 4,
            status: "pass",
            gradedBy: "Dr. Silva",
            gradedAt: "2026-01-12T10:00:00.000Z",
          },
          {
            gradeId: "grade-2",
            moduleCode: "SE202",
            moduleName: "Database Systems",
            caMarks: 31,
            finalExamMarks: 43,
            totalMarks: 74,
            gradeLetter: "B+",
            gradePoint: 3.3,
            status: "pass",
            gradedBy: "Dr. Perera",
            gradedAt: "2026-01-12T10:05:00.000Z",
          },
        ],
        summary: {
          totalModules: 2,
          passCount: 2,
          failCount: 0,
          proRataCount: 0,
          repeatCount: 0,
          averageMarks: 79.5,
          highestMarks: {
            moduleName: "Software Design",
            marks: 85,
          },
          lowestMarks: {
            moduleName: "Database Systems",
            marks: 74,
          },
        },
      },
      {
        academicYear: "2025/2026",
        semester: 2,
        semesterGPA: 2.32,
        modules: [
          {
            gradeId: "grade-3",
            moduleCode: "SE203",
            moduleName: "Computer Networks",
            caMarks: 22,
            finalExamMarks: 26,
            totalMarks: 48,
            gradeLetter: "F",
            gradePoint: 0,
            status: "repeat",
            gradedBy: "Dr. Fernando",
            gradedAt: "2026-04-01T09:00:00.000Z",
          },
          {
            gradeId: "grade-4",
            moduleCode: "SE204",
            moduleName: "Operating Systems",
            caMarks: 14,
            finalExamMarks: 25,
            totalMarks: 39,
            gradeLetter: "F",
            gradePoint: 0,
            status: "pro-rata",
            gradedBy: "Dr. Jayasinghe",
            gradedAt: "2026-04-01T09:05:00.000Z",
          },
          {
            gradeId: "grade-5",
            moduleCode: "SE205",
            moduleName: "Theory of Computation",
            caMarks: 19,
            finalExamMarks: 18,
            totalMarks: 37,
            gradeLetter: "F",
            gradePoint: 0,
            status: "fail",
            gradedBy: "Dr. Dias",
            gradedAt: "2026-04-01T09:10:00.000Z",
          },
        ],
        summary: {
          totalModules: 3,
          passCount: 0,
          failCount: 3,
          proRataCount: 1,
          repeatCount: 1,
          averageMarks: 41.3,
          highestMarks: {
            moduleName: "Computer Networks",
            marks: 48,
          },
          lowestMarks: {
            moduleName: "Theory of Computation",
            marks: 37,
          },
        },
      },
    ],
    atRiskModules: {
      proRataModules: [
        {
          gradeId: "grade-4",
          moduleCode: "SE204",
          moduleName: "Operating Systems",
          caMarks: 14,
          finalExamMarks: 25,
          totalMarks: 39,
          academicYear: "2025/2026",
          semester: 2,
          action: "Repeat the full module in the next available semester.",
        },
      ],
      repeatModules: [
        {
          gradeId: "grade-3",
          moduleCode: "SE203",
          moduleName: "Computer Networks",
          caMarks: 22,
          finalExamMarks: 26,
          totalMarks: 48,
          academicYear: "2025/2026",
          semester: 2,
          action: "Register for the repeat final exam and attend revision sessions.",
        },
      ],
      failedModules: [
        {
          gradeId: "grade-5",
          moduleCode: "SE205",
          moduleName: "Theory of Computation",
          caMarks: 19,
          finalExamMarks: 18,
          totalMarks: 37,
          academicYear: "2025/2026",
          semester: 2,
          action: "Book an academic advisor consultation before reattempting.",
        },
      ],
      totalAtRisk: 3,
      hasAnyRisk: true,
    },
    riskReport: {
      overallRiskLevel: "high",
      summary: "Three modules require follow-up before the next semester begins.",
      semesterRiskHistory: [
        {
          academicYear: "2025/2026",
          semester: 1,
          totalModules: 2,
          passCount: 2,
          failCount: 0,
          proRataCount: 0,
          repeatCount: 0,
          riskPercentage: 0,
          semesterStatus: "clear",
        },
        {
          academicYear: "2025/2026",
          semester: 2,
          totalModules: 3,
          passCount: 0,
          failCount: 1,
          proRataCount: 1,
          repeatCount: 1,
          riskPercentage: 100,
          semesterStatus: "critical",
        },
      ],
    },
    semesterWiseGPA: [
      {
        academicYear: "2025/2026",
        semester: 1,
        gpa: 3.65,
        label: "2025/2026 - Semester 1",
      },
      {
        academicYear: "2025/2026",
        semester: 2,
        gpa: 2.32,
        label: "2025/2026 - Semester 2",
      },
    ],
  },
};

const performanceModulesPayload = {
  success: true,
  data: {
    student: {
      id: STUDENT_ID,
      name: "Nimali Perera",
      registrationNumber: REGISTRATION_NUMBER,
    },
    totalModules: 5,
    modules: [
      {
        gradeId: "grade-1",
        moduleCode: "SE201",
        moduleName: "Software Design",
        academicYear: "2025/2026",
        semester: 1,
        caMarks: 35,
        finalExamMarks: 50,
        totalMarks: 85,
        gradeLetter: "A",
        gradePoint: 4,
        status: "pass",
        eligibility: {
          isProRata: false,
          isRepeat: false,
          isPass: true,
          explanation: "Passed the module successfully.",
          caStatus: "passed",
          finalStatus: "passed",
          caDeficit: 0,
          finalDeficit: 0,
        },
        gradedBy: "Dr. Silva",
        gradedAt: "2026-01-12T10:00:00.000Z",
      },
      {
        gradeId: "grade-2",
        moduleCode: "SE202",
        moduleName: "Database Systems",
        academicYear: "2025/2026",
        semester: 1,
        caMarks: 31,
        finalExamMarks: 43,
        totalMarks: 74,
        gradeLetter: "B+",
        gradePoint: 3.3,
        status: "pass",
        eligibility: {
          isProRata: false,
          isRepeat: false,
          isPass: true,
          explanation: "Passed the module successfully.",
          caStatus: "passed",
          finalStatus: "passed",
          caDeficit: 0,
          finalDeficit: 0,
        },
        gradedBy: "Dr. Perera",
        gradedAt: "2026-01-12T10:05:00.000Z",
      },
      {
        gradeId: "grade-3",
        moduleCode: "SE203",
        moduleName: "Computer Networks",
        academicYear: "2025/2026",
        semester: 2,
        caMarks: 22,
        finalExamMarks: 26,
        totalMarks: 48,
        gradeLetter: "F",
        gradePoint: 0,
        status: "repeat",
        eligibility: {
          isProRata: false,
          isRepeat: true,
          isPass: false,
          explanation: "CA is sufficient, but the final exam must be repeated.",
          caStatus: "passed",
          finalStatus: "failed",
          caDeficit: 0,
          finalDeficit: 4,
        },
        gradedBy: "Dr. Fernando",
        gradedAt: "2026-04-01T09:00:00.000Z",
      },
      {
        gradeId: "grade-4",
        moduleCode: "SE204",
        moduleName: "Operating Systems",
        academicYear: "2025/2026",
        semester: 2,
        caMarks: 14,
        finalExamMarks: 25,
        totalMarks: 39,
        gradeLetter: "F",
        gradePoint: 0,
        status: "pro-rata",
        eligibility: {
          isProRata: true,
          isRepeat: false,
          isPass: false,
          explanation: "CA threshold was not met, so the whole module must be repeated.",
          caStatus: "failed",
          finalStatus: "failed",
          caDeficit: 6,
          finalDeficit: 5,
        },
        gradedBy: "Dr. Jayasinghe",
        gradedAt: "2026-04-01T09:05:00.000Z",
      },
      {
        gradeId: "grade-5",
        moduleCode: "SE205",
        moduleName: "Theory of Computation",
        academicYear: "2025/2026",
        semester: 2,
        caMarks: 19,
        finalExamMarks: 18,
        totalMarks: 37,
        gradeLetter: "F",
        gradePoint: 0,
        status: "fail",
        eligibility: {
          isProRata: false,
          isRepeat: false,
          isPass: false,
          explanation: "Both coursework and the final exam fell below the pass threshold.",
          caStatus: "failed",
          finalStatus: "failed",
          caDeficit: 1,
          finalDeficit: 12,
        },
        gradedBy: "Dr. Dias",
        gradedAt: "2026-04-01T09:10:00.000Z",
      },
    ],
  },
};

const pointsSummaryPayload = {
  success: true,
  data: {
    studentId: STUDENT_ID,
    student: {
      name: "Nimali Perera",
      registrationNumber: REGISTRATION_NUMBER,
    },
    totalXP: 365,
    categoryBreakdown: [
      { category: "academic", totalXP: 180, count: 4 },
      { category: "quiz", totalXP: 95, count: 4 },
      { category: "milestone", totalXP: 40, count: 1 },
      { category: "bonus", totalXP: 50, count: 1 },
    ],
    recentActivity: [
      {
        action: "perfect_score",
        xpPoints: 50,
        reason: "Scored 100% in Database Systems",
        category: "academic",
        createdAt: "2026-04-20T08:30:00.000Z",
        metadata: { moduleCode: "SE202" },
      },
      {
        action: "quiz_high_score",
        xpPoints: 25,
        reason: "Scored 84% in the networking quiz",
        category: "quiz",
        createdAt: "2026-04-18T09:15:00.000Z",
        metadata: { quizTitle: "Routing and Switching Quiz" },
      },
      {
        action: "quiz_completed",
        xpPoints: 5,
        reason: "Completed the routing practice quiz",
        category: "quiz",
        createdAt: "2026-04-18T09:10:00.000Z",
        metadata: { quizTitle: "Routing and Switching Quiz" },
      },
      {
        action: "semester_gpa_above_3.5",
        xpPoints: 50,
        reason: "Reached semester GPA 3.65 in 2025/2026 Semester 1",
        category: "academic",
        createdAt: "2026-04-12T07:00:00.000Z",
        metadata: { semester: 1, academicYear: "2025/2026" },
      },
      {
        action: "milestone_reached",
        xpPoints: 40,
        reason: "Reached the 300 XP milestone",
        category: "milestone",
        createdAt: "2026-04-10T13:45:00.000Z",
        metadata: { milestone: 300 },
      },
      {
        action: "streak_bonus",
        xpPoints: 30,
        reason: "Maintained a strong semester streak",
        category: "bonus",
        createdAt: "2026-04-02T10:20:00.000Z",
        metadata: { streakLength: 2 },
      },
    ] satisfies RecentActivityItem[],
    activityCount: 6,
    pointsThisMonth: 80,
    pointsThisSemester: 145,
    averagePointsPerModule: 73,
  },
};

function buildEmptyPointsSummaryPayload() {
  return {
    success: true,
    data: {
      studentId: STUDENT_ID,
      student: {
        name: "Nimali Perera",
        registrationNumber: REGISTRATION_NUMBER,
      },
      totalXP: 0,
      categoryBreakdown: [],
      recentActivity: [],
      activityCount: 0,
      pointsThisMonth: 0,
      pointsThisSemester: 0,
      averagePointsPerModule: 0,
    },
  };
}

function buildEmptyPerformancePayload() {
  return {
    success: true,
    data: {
      student: {
        id: STUDENT_ID,
        name: "Nimali Perera",
        registrationNumber: REGISTRATION_NUMBER,
        firstName: "Nimali",
        lastName: "Perera",
        email: "nimali.perera@example.edu",
        phone: "0771234567",
        status: "ACTIVE",
      },
      overview: {
        cumulativeGPA: 0,
        classification: "No Grades Yet",
        academicStanding: {
          standing: "No Grades Yet",
          level: "satisfactory",
          color: "slate",
          message: "Performance details will appear after your first published results.",
          recommendations: [],
        },
        totalModulesTaken: 0,
        totalModulesPassed: 0,
        totalModulesFailed: 0,
        totalProRata: 0,
        totalRepeat: 0,
        totalCreditsCompleted: 0,
        totalCreditsRequired: 120,
        progressPercentage: 0,
        trend: "insufficient_data",
      },
      semesterBreakdown: [],
      atRiskModules: {
        proRataModules: [],
        repeatModules: [],
        failedModules: [],
        totalAtRisk: 0,
        hasAnyRisk: false,
      },
      riskReport: {
        overallRiskLevel: "none",
        summary: "No risk data is available until grades are published.",
        semesterRiskHistory: [],
      },
      semesterWiseGPA: [],
    },
  };
}

const gamificationConfigPayload = {
  success: true,
  data: {
    xpValues: {
      MODULE_PASSED: 10,
      HIGH_SCORE: 25,
      PERFECT_SCORE: 50,
      SEMESTER_GPA_ABOVE_3: 30,
      SEMESTER_GPA_ABOVE_3_5: 50,
      SEMESTER_ALL_PASSED: 40,
      FIRST_CLASS_GPA: 75,
      GPA_IMPROVEMENT: 20,
      QUIZ_COMPLETED: 5,
      QUIZ_ON_TIME: 10,
      QUIZ_HIGH_SCORE: 25,
      QUIZ_PERFECT_SCORE: 50,
      MILESTONE_100: 20,
      MILESTONE_300: 40,
      MILESTONE_600: 60,
      STREAK_BONUS: 30,
    },
    actions: [
      {
        action: "module_passed",
        category: "academic",
        xpPoints: 10,
        description: "Awarded when a student passes a module",
      },
      {
        action: "perfect_score",
        category: "academic",
        xpPoints: 50,
        description: "Awarded when a student scores 100% in a module",
      },
      {
        action: "quiz_high_score",
        category: "quiz",
        xpPoints: 25,
        description: "Awarded when a quiz score reaches 80% or above",
      },
      {
        action: "quiz_perfect_score",
        category: "quiz",
        xpPoints: 50,
        description: "Awarded when a quiz score reaches 100%",
      },
      {
        action: "milestone_reached",
        category: "milestone",
        xpPoints: 40,
        description: "Bonus awarded when a student reaches the 300 XP milestone",
      },
      {
        action: "streak_bonus",
        category: "bonus",
        xpPoints: 30,
        description: "Awarded for consecutive strong semesters without at-risk modules",
      },
    ],
  },
};

const leaderboardEntriesByScope: Record<ScopeKey, LeaderboardEntry[]> = {
  campus: [
    buildLeaderboardEntry(1, "Campus Ace", "TG2021/0001", 650, "Semester Champion", "platinum", 55, 110),
    buildLeaderboardEntry(2, "Nimali Perera", REGISTRATION_NUMBER, 365, "Dean's List", "silver", 25, 70),
    buildLeaderboardEntry(3, "Kasun Silva", "TG2022/1098", 320, "Sharp Mind", "silver", 12, 50),
    buildLeaderboardEntry(4, "Dilini Fernando", "TG2022/1401", 280, "Point Collector", "bronze", 8, 26),
  ],
  faculty: [
    buildLeaderboardEntry(1, "Faculty Ace", "TG2021/0020", 590, "Perfectionist", "gold", 35, 90),
    buildLeaderboardEntry(2, "Nimali Perera", REGISTRATION_NUMBER, 365, "Dean's List", "silver", 25, 70),
    buildLeaderboardEntry(3, "Kasun Silva", "TG2022/1098", 320, "Sharp Mind", "silver", 12, 50),
  ],
  degree: [
    buildLeaderboardEntry(1, "Degree Leader", "TG2021/0035", 430, "Dean's List", "silver", 20, 48),
    buildLeaderboardEntry(2, "Nimali Perera", REGISTRATION_NUMBER, 365, "Dean's List", "silver", 25, 70),
    buildLeaderboardEntry(3, "Kasun Silva", "TG2022/1098", 320, "Sharp Mind", "silver", 12, 50),
  ],
  intake: [
    buildLeaderboardEntry(1, "Intake Hero", "TG2022/0004", 410, "Steady Progress", "silver", 15, 45),
    buildLeaderboardEntry(2, "Nimali Perera", REGISTRATION_NUMBER, 365, "Dean's List", "silver", 25, 70),
    buildLeaderboardEntry(3, "Dilini Fernando", "TG2022/1401", 280, "Point Collector", "bronze", 8, 26),
  ],
};

function buildTrophyItem(input: {
  key: string;
  name: string;
  description: string;
  icon: string;
  tier: TrophyTier;
  category: TrophyCategory;
  condition: string;
  xpBonus: number;
  earned: boolean;
  earnedAt?: string | null;
  metadata?: Record<string, unknown> | null;
}): TrophyItem {
  return {
    definition: {
      key: input.key,
      name: input.name,
      description: input.description,
      icon: input.icon,
      tier: input.tier,
      category: input.category,
      condition: input.condition,
      xpBonus: input.xpBonus,
    },
    earned: input.earned,
    earnedAt: input.earnedAt ?? null,
    metadata: input.metadata ?? null,
  };
}

function buildTrophiesPayload(includeFreshUnlock: boolean) {
  const items: TrophyItem[] = [
    buildTrophyItem({
      key: "deans_list",
      name: "Dean's List",
      description: "Achieved semester GPA above 3.5",
      icon: "DL",
      tier: "silver",
      category: "gpa",
      condition: "Achieve semester GPA above 3.5",
      xpBonus: 25,
      earned: true,
      earnedAt: "2026-04-12T07:00:00.000Z",
      metadata: { semesterGPA: 3.65, academicYear: "2025/2026", semester: 1 },
    }),
    buildTrophyItem({
      key: "perfect_score",
      name: "Perfectionist",
      description: "Achieved a perfect 100% score in a module",
      icon: "PS",
      tier: "gold",
      category: "score",
      condition: "Score 100% in any module",
      xpBonus: 35,
      earned: true,
      earnedAt: "2026-04-20T08:30:00.000Z",
      metadata: { moduleCode: "SE202", score: 100 },
    }),
    buildTrophyItem({
      key: "xp_intermediate",
      name: "XP Warrior",
      description: "Accumulated 300 XP",
      icon: "XP",
      tier: "silver",
      category: "milestone",
      condition: "Reach 300 XP",
      xpBonus: 20,
      earned: true,
      earnedAt: "2026-04-10T13:45:00.000Z",
      metadata: { totalXP: 300 },
    }),
    buildTrophyItem({
      key: "semester_champion",
      name: "Semester Champion",
      description: "Best performance in a semester with all passes and a high score",
      icon: "SC",
      tier: "platinum",
      category: "semester",
      condition: "Pass all modules with at least one 80%+ score in a semester",
      xpBonus: 45,
      earned: includeFreshUnlock,
      earnedAt: includeFreshUnlock ? "2026-04-25T10:00:00.000Z" : null,
      metadata: includeFreshUnlock
        ? { academicYear: "2025/2026", semester: 1, highestScore: 85 }
        : null,
    }),
    buildTrophyItem({
      key: "level_4_reached",
      name: "Campus Champion",
      description: "Reached the highest level",
      icon: "CC",
      tier: "platinum",
      category: "level",
      condition: "Reach Champion level (600 XP)",
      xpBonus: 50,
      earned: false,
      earnedAt: null,
      metadata: null,
    }),
  ];

  const totalXP = 365;
  const recentlyEarned = items
    .filter((item) => item.earned && item.earnedAt)
    .map((item) => ({
      trophyKey: item.definition.key,
      trophyName: item.definition.name,
      trophyDescription: item.definition.description,
      trophyIcon: item.definition.icon,
      trophyTier: item.definition.tier,
      category: item.definition.category,
      xpBonusAwarded: item.definition.xpBonus,
      condition: item.definition.condition,
      earnedAt: item.earnedAt ?? "",
      metadata: item.metadata,
    }))
    .sort(
      (left, right) =>
        new Date(right.earnedAt).getTime() - new Date(left.earnedAt).getTime()
    );

  const totalEarned = items.filter((item) => item.earned).length;
  const earnedPercentage = Number(((totalEarned / items.length) * 100).toFixed(1));

  return {
    success: true,
    data: {
      student: {
        id: STUDENT_ID,
        name: "Nimali Perera",
        registrationNumber: REGISTRATION_NUMBER,
      },
      level: {
        current: getCurrentLevel(totalXP),
        next: getNextLevel(totalXP),
        progress: getLevelProgress(totalXP),
        badge: getLevelBadge(totalXP),
        comparison: getLevelComparison(totalXP),
        totalXP,
      },
      trophies: {
        totalAvailable: items.length,
        totalEarned,
        earnedPercentage,
        items,
        byTier: buildTierStats(items),
        byCategory: buildCategoryStats(items),
        recentlyEarned,
      },
    },
  };
}

function buildTierStats(items: TrophyItem[]) {
  return {
    bronze: summarizeTrophiesByTier(items, "bronze"),
    silver: summarizeTrophiesByTier(items, "silver"),
    gold: summarizeTrophiesByTier(items, "gold"),
    platinum: summarizeTrophiesByTier(items, "platinum"),
    diamond: summarizeTrophiesByTier(items, "diamond"),
  };
}

function summarizeTrophiesByTier(items: TrophyItem[], tier: TrophyTier) {
  const selected = items.filter((item) => item.definition.tier === tier);
  return {
    total: selected.length,
    earned: selected.filter((item) => item.earned).length,
  };
}

function buildCategoryStats(items: TrophyItem[]) {
  const groups = new Map<TrophyCategory, { total: number; earned: number }>();

  items.forEach((item) => {
    const current = groups.get(item.definition.category) ?? { total: 0, earned: 0 };
    current.total += 1;
    if (item.earned) {
      current.earned += 1;
    }
    groups.set(item.definition.category, current);
  });

  return Object.fromEntries(groups.entries());
}

function buildLeaderboardEntry(
  rank: number,
  name: string,
  registrationNumber: string,
  totalXP: number,
  topTrophyName: string,
  topTrophyTier: string,
  last7Days: number,
  last30Days: number
): LeaderboardEntry {
  return {
    rank,
    student: {
      id: name === "Nimali Perera" ? STUDENT_ID : `student-${registrationNumber}`,
      name,
      registrationNumber,
      faculty: "Faculty of Computing",
      degreeProgram: "Software Engineering",
      intake: "2022 Intake A",
    },
    totalXP,
    level: getCurrentLevel(totalXP),
    topTrophy: {
      key: topTrophyName.toLowerCase().replace(/\s+/g, "_"),
      name: topTrophyName,
      icon: "TR",
      tier: topTrophyTier,
    },
    xpChange: {
      last7Days,
      last30Days,
    },
  };
}

function buildLeaderboardPayload(scope: ScopeKey) {
  return buildLeaderboardPayloadFromEntries(scope, leaderboardEntriesByScope[scope]);
}

function buildLeaderboardPayloadFromEntries(
  scope: ScopeKey,
  entries: LeaderboardEntry[],
  page = 1,
  limit = 50
) {
  const currentEntry = findCurrentStudentEntry(entries);
  const totalStudents = entries.length;
  const percentile = Number(
    (((totalStudents - currentEntry.rank) / totalStudents) * 100).toFixed(1)
  );
  const scopeName =
    scope === "campus"
      ? "Campus"
      : scope === "faculty"
        ? "Faculty of Computing"
        : scope === "degree"
          ? "Software Engineering"
          : "2022 Intake A";

  return {
    success: true,
    data: {
      scope,
      scopeName,
      totalStudents,
      activeParticipants: entries.filter((entry) => entry.totalXP > 0).length,
      lastUpdated: "2026-04-25T10:05:00.000Z",
      personalRank: {
        rank: currentEntry.rank,
        totalXP: currentEntry.totalXP,
        totalStudents,
        percentile,
        message: `You are #${currentEntry.rank} out of ${totalStudents} students.`,
      },
      leaderboard: entries.slice((page - 1) * limit, (page - 1) * limit + limit),
      pagination: {
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalStudents / limit)),
        totalEntries: totalStudents,
        hasNext: page * limit < totalStudents,
        hasPrev: page > 1,
      },
    },
  };
}

function buildAroundPayload(scope: ScopeKey) {
  return buildAroundPayloadFromEntries(scope, leaderboardEntriesByScope[scope]);
}

function buildAroundPayloadFromEntries(scope: ScopeKey, entries: LeaderboardEntry[]) {
  const currentIndex = entries.findIndex((entry) => entry.student.id === STUDENT_ID);
  const currentEntry = entries[currentIndex];

  return {
    success: true,
    data: {
      student: {
        id: currentEntry.student.id,
        name: currentEntry.student.name,
        registrationNumber: currentEntry.student.registrationNumber,
        rank: currentEntry.rank,
        totalXP: currentEntry.totalXP,
        level: currentEntry.level,
      },
      above: entries.slice(Math.max(0, currentIndex - 2), currentIndex),
      below: entries.slice(currentIndex + 1, currentIndex + 3),
    },
  };
}

function buildStatsPayload(scope: ScopeKey) {
  return buildStatsPayloadFromEntries(scope, leaderboardEntriesByScope[scope]);
}

function buildStatsPayloadFromEntries(scope: ScopeKey, entries: LeaderboardEntry[]) {
  const currentEntry = findCurrentStudentEntry(entries);
  const nextHigher = [...entries]
    .slice(0, entries.findIndex((entry) => entry.student.id === STUDENT_ID))
    .reverse()
    .find((entry) => entry.totalXP > currentEntry.totalXP);
  const nextLower = entries
    .slice(entries.findIndex((entry) => entry.student.id === STUDENT_ID) + 1)
    .find((entry) => entry.totalXP < currentEntry.totalXP);
  const totalStudents = entries.length;
  const percentile = Number(
    (((totalStudents - currentEntry.rank) / totalStudents) * 100).toFixed(1)
  );

  return {
    success: true,
    data: {
      student: {
        id: STUDENT_ID,
        name: "Nimali Perera",
        registrationNumber: REGISTRATION_NUMBER,
      },
      rank: currentEntry.rank,
      totalXP: currentEntry.totalXP,
      totalStudents,
      activeParticipants: totalStudents,
      percentile,
      xpToNextRank: nextHigher ? nextHigher.totalXP - currentEntry.totalXP + 1 : 0,
      xpFromPreviousRank: nextLower ? currentEntry.totalXP - nextLower.totalXP : 0,
      studentsAbove: currentEntry.rank - 1,
      studentsBelow: totalStudents - currentEntry.rank,
      topStudent: {
        name: entries[0].student.name,
        totalXP: entries[0].totalXP,
        rank: entries[0].rank,
      },
      message: `You are #${currentEntry.rank} out of ${totalStudents} students (top ${(
        100 - percentile
      ).toFixed(1)}%).`,
    },
  };
}

function buildTopPayload(scope: ScopeKey, limit: number) {
  return buildTopPayloadFromEntries(scope, leaderboardEntriesByScope[scope], limit);
}

function buildTopPayloadFromEntries(
  scope: ScopeKey,
  entries: LeaderboardEntry[],
  limit: number
) {
  return {
    success: true,
    data: {
      scope,
      topStudents: entries.slice(0, limit).map((entry) => ({
        rank: entry.rank,
        student: {
          id: entry.student.id,
          name: entry.student.name,
          registrationNumber: entry.student.registrationNumber,
        },
        totalXP: entry.totalXP,
        level: {
          number: entry.level.level,
          name: entry.level.name,
          icon: entry.level.icon,
          color: entry.level.color,
        },
        topTrophy: entry.topTrophy
          ? {
              name: entry.topTrophy.name,
              icon: entry.topTrophy.icon,
              tier: entry.topTrophy.tier,
            }
          : null,
      })),
      totalStudents: entries.length,
      activeParticipants: entries.length,
      lastUpdated: "2026-04-25T10:05:00.000Z",
    },
  };
}

const quizPreviewPayload = {
  success: true,
  data: {
    id: "quiz-xp-1",
    title: "Networking Fundamentals Quiz",
    description: "A short quiz used to verify XP rewards after submission.",
    duration: 20,
    totalMarks: 10,
    passingMarks: 5,
    deadline: "2030-01-01T10:00:00.000Z",
    questions: [
      {
        _id: "question-1",
        questionText: "Which protocol is used to resolve a domain name to an IP address?",
        questionType: "single_choice",
        allowMultipleAnswers: false,
        options: [
          { _id: "option-1", optionText: "DNS" },
          { _id: "option-2", optionText: "FTP" },
          { _id: "option-3", optionText: "SSH" },
        ],
        marks: 10,
        order: 1,
      },
    ],
  },
};

const quizAttemptPayload = {
  success: true,
  data: {
    attempt: {
      id: "attempt-quiz-xp-1",
      attemptNumber: 1,
      startedAt: "2026-04-25T09:00:00.000Z",
      timeLimit: 20,
      deadline: "2030-01-01T10:00:00.000Z",
    },
    quiz: quizPreviewPayload.data,
  },
};

const quizSubmissionPayload = {
  success: true,
  data: {
    attempt: {
      id: "attempt-quiz-xp-1",
      score: 10,
      totalMarks: 10,
      percentage: 100,
      passed: true,
      timeTaken: 75,
      isOnTime: true,
      isWithinTimeLimit: true,
      status: "submitted",
    },
    results: {
      answers: [
        {
          questionId: "question-1",
          questionText:
            "Which protocol is used to resolve a domain name to an IP address?",
          questionType: "single_choice",
          isCorrect: true,
          marksAwarded: 10,
          questionMarks: 10,
          correctAnswer: "DNS",
          selectedAnswer: "DNS",
        },
      ],
    },
    xpAwarded: {
      totalXP: 30,
      actions: [
        {
          action: "quiz_completed",
          xpPoints: 5,
          reason: "Completed the quiz successfully",
        },
        {
          action: "quiz_high_score",
          xpPoints: 25,
          reason: "Scored 100% in Networking Fundamentals Quiz",
        },
      ],
      milestonesUnlocked: ["300 XP Milestone"],
      newTotalXP: 395,
    },
    message: "Quiz submitted successfully! You scored 100% and earned 30 XP!",
  },
};

function findCurrentStudentEntry(entries: LeaderboardEntry[]) {
  const currentEntry = entries.find((entry) => entry.student.id === STUDENT_ID);
  if (!currentEntry) {
    throw new Error("Current student entry is missing from leaderboard test data.");
  }
  return currentEntry;
}

async function seedStudentSession(page: Page) {
  await page.addInitScript(
    ([roleKey, userKey, userJson]) => {
      window.localStorage.setItem(roleKey, "STUDENT");
      window.localStorage.setItem(userKey, userJson);
    },
    [ROLE_STORAGE_KEY, USER_STORAGE_KEY, JSON.stringify(studentSessionUser)]
  );
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function readScope(url: URL): ScopeKey {
  const rawScope = url.searchParams.get("scope");
  if (
    rawScope === "campus" ||
    rawScope === "faculty" ||
    rawScope === "degree" ||
    rawScope === "intake"
  ) {
    return rawScope;
  }

  return "campus";
}

async function installAcademicGamificationMock(page: Page) {
  let milestoneChecked = false;

  await page.route("**/*", async (route) => {
    const requestUrl = route.request().url();
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(requestUrl);
    } catch {
      await route.continue();
      return;
    }

    const { pathname } = parsedUrl;
    const method = route.request().method();

    if (pathname === "/api/students") {
      await fulfillJson(route, { items: [studentRecord], total: 1 });
      return;
    }

    if (pathname === `/api/students/${STUDENT_ID}/enrollments`) {
      await fulfillJson(route, { items: [enrollment] });
      return;
    }

    if (pathname === `/api/students/${STUDENT_ID}`) {
      await fulfillJson(route, studentRecord);
      return;
    }

    if (pathname === `/api/performance/${STUDENT_ID}`) {
      await fulfillJson(route, performancePayload);
      return;
    }

    if (pathname === `/api/performance/${STUDENT_ID}/modules`) {
      await fulfillJson(route, performanceModulesPayload);
      return;
    }

    if (pathname === `/api/gamification/points/${STUDENT_ID}`) {
      await fulfillJson(route, pointsSummaryPayload);
      return;
    }

    if (pathname === "/api/gamification/config") {
      await fulfillJson(route, gamificationConfigPayload);
      return;
    }

    if (pathname === `/api/gamification/trophies/${STUDENT_ID}/check` && method === "POST") {
      milestoneChecked = true;
      await fulfillJson(route, {
        success: true,
        data: {
          success: true,
          studentId: STUDENT_ID,
          newTrophiesAwarded: [
            {
              trophyKey: "semester_champion",
              trophyName: "Semester Champion",
              trophyIcon: "SC",
              trophyTier: "platinum",
              xpBonusAwarded: 45,
              message: "Semester Champion unlocked.",
            },
          ],
          totalNewTrophies: 1,
          totalXPBonusAwarded: 45,
          existingTrophyCount: 3,
          errors: [],
        },
      });
      return;
    }

    if (pathname === `/api/gamification/trophies/${STUDENT_ID}`) {
      await fulfillJson(route, buildTrophiesPayload(milestoneChecked));
      return;
    }

    if (pathname.startsWith("/api/gamification/leaderboard/around/")) {
      await fulfillJson(route, buildAroundPayload(readScope(parsedUrl)));
      return;
    }

    if (pathname === "/api/gamification/leaderboard/stats") {
      await fulfillJson(route, buildStatsPayload(readScope(parsedUrl)));
      return;
    }

    if (pathname === "/api/gamification/leaderboard/top") {
      const limit = Number(parsedUrl.searchParams.get("limit") ?? "3") || 3;
      await fulfillJson(route, buildTopPayload(readScope(parsedUrl), limit));
      return;
    }

    if (pathname === "/api/gamification/leaderboard") {
      await fulfillJson(route, buildLeaderboardPayload(readScope(parsedUrl)));
      return;
    }

    await route.continue();
  });
}

test.beforeEach(async ({ page }) => {
  await seedStudentSession(page);
  await installAcademicGamificationMock(page);
});

test("shows the student performance view with risk and refresh feedback", async ({
  page,
}) => {
  await page.goto("/student/performance");

  await expect(
    page.getByRole("heading", { name: "My Academic Performance" })
  ).toBeVisible();
  await expect(page.getByText("Overall Risk Level", { exact: true })).toBeVisible();
  await expect(
    page.getByText("You have 3 module(s) requiring attention")
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Operating Systems", exact: true })
  ).toBeVisible();
  await expect(
    page.getByText(/academic advisor consultation before reattempting/i)
  ).toBeVisible();

  await page.getByRole("button", { name: "Refresh" }).click();

  await expect(page.getByText("Refreshed", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Performance data has been updated.", { exact: true })
  ).toBeVisible();
});

test("shows XP breakdown and expands recent activity on the gamification page", async ({
  page,
}) => {
  await page.goto("/student/gamification");

  await expect(page.getByRole("heading", { name: "My XP & Rewards" })).toBeVisible();
  await expect(page.getByText("Total XP", { exact: true })).toBeVisible();
  await expect(page.getByText("365 XP", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText("Points Breakdown by Category", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("Scored 100% in Database Systems", { exact: true })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "View All" })).toBeVisible();

  await page.getByRole("button", { name: "View All" }).click();

  await expect(
    page.getByText("Maintained a strong semester streak", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("How to Earn XP", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Awarded when a quiz score reaches 100%", { exact: true })
  ).toBeVisible();
});

test("checks for new trophies and opens the trophy detail drawer", async ({
  page,
}) => {
  await page.goto("/student/trophies");

  await expect(
    page.getByRole("heading", { name: "Levels & Trophies" })
  ).toBeVisible();
  await expect(page.getByText("Recently Earned", { exact: true })).toBeVisible();
  await expect(page.getByText("Dean's List", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Check for New Trophies" }).click();

  await expect(page.getByText("New trophies unlocked", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Semester Champion", { exact: true }).first()
  ).toBeVisible();

  await page.getByText("Perfectionist", { exact: true }).first().click();

  await expect(page.getByText("Trophy Details", { exact: true })).toBeVisible();
  await expect(
    page
      .getByText("Achieved a perfect 100% score in a module", { exact: true })
      .last()
  ).toBeVisible();
  await expect(page.getByText("+35 XP bonus", { exact: true })).toBeVisible();
});

test("filters and switches scope on the leaderboard page", async ({ page }) => {
  await page.goto("/student/leaderboard");

  await expect(page.getByRole("heading", { name: "XP Leaderboard" })).toBeVisible();
  await expect(page.getByText("Students Around You", { exact: true })).toBeVisible();

  const table = page.getByRole("table").first();
  await expect(table.getByText("Campus Ace", { exact: true })).toBeVisible();
  await expect(table.getByText("Nimali Perera", { exact: true })).toBeVisible();

  await page
    .getByPlaceholder("Search by student name or ID")
    .fill("Kasun Silva");

  await expect(table.getByText("Kasun Silva", { exact: true })).toBeVisible();
  await expect(table.getByText("Campus Ace", { exact: true })).not.toBeVisible();

  await page.getByPlaceholder("Search by student name or ID").fill("");
  await page.getByRole("tab", { name: /Faculty/i }).click();

  await expect(table.getByText("Faculty Ace", { exact: true })).toBeVisible();
  await expect(table.getByText("Campus Ace", { exact: true })).not.toBeVisible();
});

test("shows the empty performance state when no grades are recorded", async ({
  page,
}) => {
  await page.route(`**/api/performance/${STUDENT_ID}`, async (route) => {
    await fulfillJson(route, buildEmptyPerformancePayload());
  });
  await page.route(`**/api/performance/${STUDENT_ID}/modules`, async (route) => {
    await fulfillJson(route, {
      success: true,
      data: {
        student: {
          id: STUDENT_ID,
          name: "Nimali Perera",
          registrationNumber: REGISTRATION_NUMBER,
        },
        totalModules: 0,
        modules: [],
      },
    });
  });

  await page.goto("/student/performance");

  await expect(
    page.getByRole("heading", { name: "No grades recorded yet" })
  ).toBeVisible();
  await expect(
    page.getByText(
      "Your academic performance data will appear here once your results are published.",
      { exact: true }
    )
  ).toBeVisible();
});

test("shows the empty gamification state and no-new-trophies feedback", async ({
  page,
}) => {
  await page.route(`**/api/gamification/points/${STUDENT_ID}`, async (route) => {
    await fulfillJson(route, buildEmptyPointsSummaryPayload());
  });

  await page.goto("/student/gamification");

  await expect(
    page.getByRole("heading", { name: "Welcome to UniHub Rewards!" })
  ).toBeVisible();
  await expect(
    page.getByText("No XP activity yet. Complete modules and quizzes to start earning points!", {
      exact: true,
    })
  ).toBeVisible();

  await page.route(`**/api/gamification/trophies/${STUDENT_ID}/check`, async (route) => {
    await fulfillJson(route, {
      success: true,
      data: {
        success: true,
        studentId: STUDENT_ID,
        newTrophiesAwarded: [],
        totalNewTrophies: 0,
        totalXPBonusAwarded: 0,
        existingTrophyCount: 3,
        errors: [],
      },
    });
  });

  await page.goto("/student/trophies");
  await page.getByRole("button", { name: "Check for New Trophies" }).click();

  await expect(page.getByText("All caught up", { exact: true })).toBeVisible();
  await expect(
    page.getByText("No new trophies are available right now.", { exact: true })
  ).toBeVisible();
});

test("shows gamification and trophies error states when their APIs fail", async ({
  page,
}) => {
  await page.route(`**/api/gamification/points/${STUDENT_ID}`, async (route) => {
    await fulfillJson(
      route,
      { success: false, error: "Rewards service is unavailable." },
      500
    );
  });

  await page.goto("/student/gamification");

  await expect(
    page.getByRole("heading", { name: "Failed to load rewards data" })
  ).toBeVisible();
  await expect(
    page.getByText("Rewards service is unavailable.", { exact: true })
  ).toBeVisible();

  await page.route(`**/api/gamification/trophies/${STUDENT_ID}`, async (route) => {
    await fulfillJson(
      route,
      { success: false, error: "Achievement data is temporarily unavailable." },
      500
    );
  });

  await page.goto("/student/trophies");

  await expect(
    page.getByRole("heading", { name: "Failed to load levels and trophies" })
  ).toBeVisible();
  await expect(
    page
      .getByText("Achievement data is temporarily unavailable.", { exact: true })
      .first()
  ).toBeVisible();
});

test("shows leaderboard partial-data and empty-competition states", async ({
  page,
}) => {
  const emptyEntries: LeaderboardEntry[] = [
    buildLeaderboardEntry(1, "Campus Ace", "TG2021/0001", 0, "No Trophy", "bronze", 0, 0),
    buildLeaderboardEntry(2, "Nimali Perera", REGISTRATION_NUMBER, 0, "No Trophy", "bronze", 0, 0),
    buildLeaderboardEntry(3, "Kasun Silva", "TG2022/1098", 0, "No Trophy", "bronze", 0, 0),
  ];

  await page.route("**/api/gamification/leaderboard*", async (route) => {
    const url = new URL(route.request().url());
    await fulfillJson(
      route,
      buildLeaderboardPayloadFromEntries(readScope(url), emptyEntries)
    );
  });
  await page.route("**/api/gamification/leaderboard/top**", async (route) => {
    const url = new URL(route.request().url());
    const limit = Number(url.searchParams.get("limit") ?? "3") || 3;
    await fulfillJson(route, buildTopPayloadFromEntries(readScope(url), emptyEntries, limit));
  });
  await page.route("**/api/gamification/leaderboard/around/**", async (route) => {
    const url = new URL(route.request().url());
    await fulfillJson(route, buildAroundPayloadFromEntries(readScope(url), emptyEntries));
  });
  await page.route("**/api/gamification/leaderboard/stats**", async (route) => {
    await fulfillJson(
      route,
      { success: false, error: "Stats service timed out." },
      500
    );
  });

  await page.goto("/student/leaderboard");

  await expect(page.getByText("Stats service timed out.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "The leaderboard is waiting for its first champion!",
    })
  ).toBeVisible();
});

test("supports leaderboard pagination and sort edge cases", async ({ page }) => {
  const manyEntries: LeaderboardEntry[] = Array.from({ length: 30 }, (_, index) => {
    const rank = index + 1;
    const totalXP = 600 - index * 10;
    return buildLeaderboardEntry(
      rank,
      rank === 15 ? "Nimali Perera" : `Student ${String(rank).padStart(2, "0")}`,
      rank === 15 ? REGISTRATION_NUMBER : `TG2022/${String(rank).padStart(4, "0")}`,
      totalXP,
      "Dean's List",
      "silver",
      Math.max(0, 30 - index),
      Math.max(0, 90 - index * 2)
    );
  });

  await page.route("**/api/gamification/leaderboard*", async (route) => {
    const url = new URL(route.request().url());
    const pageValue = Number(url.searchParams.get("page") ?? "1") || 1;
    const limitValue = Number(url.searchParams.get("limit") ?? "50") || 50;
    await fulfillJson(
      route,
      buildLeaderboardPayloadFromEntries(
        readScope(url),
        manyEntries,
        pageValue,
        limitValue
      )
    );
  });
  await page.route("**/api/gamification/leaderboard/top**", async (route) => {
    const url = new URL(route.request().url());
    const limit = Number(url.searchParams.get("limit") ?? "3") || 3;
    await fulfillJson(route, buildTopPayloadFromEntries(readScope(url), manyEntries, limit));
  });
  await page.route("**/api/gamification/leaderboard/around/**", async (route) => {
    const url = new URL(route.request().url());
    await fulfillJson(route, buildAroundPayloadFromEntries(readScope(url), manyEntries));
  });
  await page.route("**/api/gamification/leaderboard/stats**", async (route) => {
    const url = new URL(route.request().url());
    await fulfillJson(route, buildStatsPayloadFromEntries(readScope(url), manyEntries));
  });

  await page.goto("/student/leaderboard");

  await page.locator("select").first().selectOption("25");
  await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();

  const table = page.getByRole("table").first();
  await expect(table.getByText("Student 25", { exact: true })).toBeVisible();
  await expect(table.getByText("Student 26", { exact: true })).not.toBeVisible();

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  await expect(table.getByText("Student 26", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Previous" }).click();
  await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /^XP/ }).click();
  await expect(table.locator("tbody tr").first()).toContainText("Student 01");

  await page.getByRole("button", { name: /^XP/ }).click();
  await expect(table.locator("tbody tr").first()).toContainText("Student 25");

  await page.getByPlaceholder("Search by student name or ID").fill("not-a-real-student");
  await expect(
    page.getByText("No students matched the current page search.", { exact: true })
  ).toBeVisible();
});

test("submits a quiz and renders the XP rewards panel", async ({ page }) => {
  const quizId = "playwright-quiz-xp";

  await page.route(`**/api/quizzes/${quizId}?studentView=true`, async (route) => {
    await fulfillJson(route, quizPreviewPayload);
  });
  await page.route(`**/api/quizzes/${quizId}/attempt`, async (route) => {
    await fulfillJson(route, quizAttemptPayload);
  });
  await page.route(`**/api/quizzes/${quizId}/submit`, async (route) => {
    await fulfillJson(route, quizSubmissionPayload);
  });

  await page.goto(`/student/quizzes/${quizId}`);

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.getByRole("button", { name: "Start Quiz" }).click();
  await page.getByLabel("DNS").check();
  await page.getByRole("button", { name: "Finish Quiz" }).first().click();
  await page.getByRole("button", { name: "Finish Quiz" }).last().click();

  await expect(page.getByRole("heading", { name: "Quiz Completed" })).toBeVisible();
  await expect(page.getByText("XP Earned", { exact: true })).toBeVisible();
  await expect(page.getByText("+30 XP", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("395 XP", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Scored 100% in Networking Fundamentals Quiz", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("300 XP Milestone", { exact: true })).toBeVisible();
});

test("covers admin recalculation and revoke endpoint contracts", async ({
  page,
}) => {
  const recalcCalls: Array<{ method: string; body: unknown }> = [];
  const revokeCalls: Array<{ method: string; body: unknown }> = [];
  const ledgerEntryId = "507f1f77bcf86cd7994390bb";

  await page.route(`**/api/gamification/points/${STUDENT_ID}/recalculate`, async (route) => {
    recalcCalls.push({
      method: route.request().method(),
      body: route.request().postDataJSON(),
    });
    await fulfillJson(route, {
      success: true,
      data: {
        studentId: STUDENT_ID,
        newTotalXP: 420,
        delta: 55,
        totalNewTrophies: 1,
      },
    });
  });

  await page.route(`**/api/gamification/points/${STUDENT_ID}/revoke`, async (route) => {
    revokeCalls.push({
      method: route.request().method(),
      body: route.request().postDataJSON(),
    });
    await fulfillJson(route, {
      success: true,
      data: {
        message: "Points entry revoked successfully.",
        newTotalXP: 350,
      },
    });
  });

  await page.goto("/");

  const recalcResult = await page.evaluate(async (studentId) => {
    const response = await fetch(`/api/gamification/points/${studentId}/recalculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "playwright-contract-test" }),
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  }, STUDENT_ID);

  const revokeResult = await page.evaluate(
    async ({ studentId, ledgerEntryId }) => {
      const response = await fetch(`/api/gamification/points/${studentId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerEntryId,
          reason: "Playwright contract test",
        }),
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    },
    { studentId: STUDENT_ID, ledgerEntryId }
  );

  expect(recalcResult.status).toBe(200);
  expect(revokeResult.status).toBe(200);
  expect(recalcResult.body.data.newTotalXP).toBe(420);
  expect(revokeResult.body.data.newTotalXP).toBe(350);
  expect(recalcCalls).toEqual([
    {
      method: "POST",
      body: { source: "playwright-contract-test" },
    },
  ]);
  expect(revokeCalls).toEqual([
    {
      method: "POST",
      body: {
        ledgerEntryId,
        reason: "Playwright contract test",
      },
    },
  ]);
});

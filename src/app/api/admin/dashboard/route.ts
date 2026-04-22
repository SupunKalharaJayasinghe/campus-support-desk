import { NextResponse } from "next/server";
import "@/models/Announcement";
import "@/models/DegreeProgram";
import "@/models/Enrollment";
import "@/models/Faculty";
import "@/models/Intake";
import "@/models/Lecturer";
import "@/models/Module";
import "@/models/ModuleOffering";
import "@/models/Student";
import "@/models/SupportTicket";
import { AnnouncementModel } from "@/models/Announcement";
import { DegreeProgramModel } from "@/models/DegreeProgram";
import { EnrollmentModel } from "@/models/Enrollment";
import { FacultyModel } from "@/models/Faculty";
import { IntakeModel } from "@/models/Intake";
import { LecturerModel } from "@/models/Lecturer";
import { ModuleModel } from "@/models/Module";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { connectMongoose } from "@/models/mongoose";
import { StudentModel } from "@/models/Student";
import {
  SupportTicketModel,
  matchSupportTicketStatusCaseInsensitive,
} from "@/models/SupportTicket";

type AlertLevel = "High" | "Medium";

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toIsoDate(value: unknown) {
  const parsed = new Date(String(value ?? "").trim());
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString();
}

function createActivityItem(
  id: string,
  title: string,
  detail: string,
  occurredAt: unknown
) {
  const timestamp = toIsoDate(occurredAt);
  if (!timestamp) {
    return null;
  }

  return {
    id,
    title,
    detail,
    occurredAt: timestamp,
  };
}

function createAlert(id: string, title: string, detail: string, level: AlertLevel) {
  return { id, title, detail, level };
}

export async function GET() {
  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const [
    totalStudents,
    activeStudents,
    totalFaculties,
    activeFaculties,
    totalDegreePrograms,
    activeDegreePrograms,
    totalLecturers,
    activeLecturers,
    totalModules,
    totalIntakes,
    activeIntakes,
    facultyDistributionRows,
    degreeDistributionRows,
    distinctSubgroups,
    activeOfferingCount,
    offeringsWithoutLecturers,
    offeringsWithoutContent,
    enrollmentsWithoutSubgroup,
    latestStudents,
    latestLecturers,
    latestOfferings,
    latestIntakes,
    latestAnnouncements,
    totalTickets,
    openTickets,
    inProgressTickets,
    resolvedTickets,
    latestTickets,
    activeIntake,
    faculties,
    degrees,
  ] = await Promise.all([
    StudentModel.countDocuments({}).catch(() => 0),
    StudentModel.countDocuments({ status: "ACTIVE" }).catch(() => 0),
    FacultyModel.countDocuments({ isDeleted: { $ne: true } }).catch(() => 0),
    FacultyModel.countDocuments({
      isDeleted: { $ne: true },
      status: "ACTIVE",
    }).catch(() => 0),
    DegreeProgramModel.countDocuments({ isDeleted: { $ne: true } }).catch(() => 0),
    DegreeProgramModel.countDocuments({
      isDeleted: { $ne: true },
      status: "ACTIVE",
    }).catch(() => 0),
    LecturerModel.countDocuments({}).catch(() => 0),
    LecturerModel.countDocuments({ status: "ACTIVE" }).catch(() => 0),
    ModuleModel.countDocuments({}).catch(() => 0),
    IntakeModel.countDocuments({}).catch(() => 0),
    IntakeModel.countDocuments({ status: "ACTIVE" }).catch(() => 0),
    EnrollmentModel.aggregate([
      { $match: { facultyId: { $exists: true, $ne: "" } } },
      { $group: { _id: "$facultyId", value: { $sum: 1 } } },
      { $sort: { value: -1, _id: 1 } },
      { $limit: 5 },
    ]).catch(() => []),
    EnrollmentModel.aggregate([
      { $match: { degreeProgramId: { $exists: true, $ne: "" } } },
      { $group: { _id: "$degreeProgramId", value: { $sum: 1 } } },
      { $sort: { value: -1, _id: 1 } },
      { $limit: 5 },
    ]).catch(() => []),
    EnrollmentModel.distinct("subgroup", {
      subgroup: { $type: "string", $ne: "" },
    }).catch(() => []),
    ModuleOfferingModel.countDocuments({ status: "ACTIVE" }).catch(() => 0),
    ModuleOfferingModel.countDocuments({
      status: "ACTIVE",
      $expr: {
        $and: [
          { $eq: [{ $size: { $ifNull: ["$assignedLecturerIds", []] } }, 0] },
          { $eq: [{ $size: { $ifNull: ["$assignedLecturers", []] } }, 0] },
        ],
      },
    }).catch(() => 0),
    ModuleOfferingModel.countDocuments({
      status: "ACTIVE",
      $or: [{ hasContent: false }, { outlinePending: true }],
    }).catch(() => 0),
    EnrollmentModel.countDocuments({
      $or: [{ subgroup: null }, { subgroup: "" }],
    }).catch(() => 0),
    StudentModel.find({})
      .select({ firstName: 1, lastName: 1, studentId: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .limit(2)
      .lean()
      .exec()
      .catch(() => []),
    LecturerModel.find({})
      .select({ fullName: 1, email: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .limit(2)
      .lean()
      .exec()
      .catch(() => []),
    ModuleOfferingModel.find({})
      .select({ moduleCode: 1, moduleName: 1, intakeName: 1, termCode: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .limit(2)
      .lean()
      .exec()
      .catch(() => []),
    IntakeModel.find({})
      .select({ name: 1, currentTerm: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .limit(2)
      .lean()
      .exec()
      .catch(() => []),
    AnnouncementModel.find({ isDeleted: { $ne: true } })
      .select({ title: 1, targetLabel: 1, createdAt: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .limit(2)
      .lean()
      .exec()
      .catch(() => []),
    SupportTicketModel.countDocuments({}).catch(() => 0),
    SupportTicketModel.countDocuments(matchSupportTicketStatusCaseInsensitive("Open")).catch(
      () => 0
    ),
    SupportTicketModel.countDocuments(
      matchSupportTicketStatusCaseInsensitive("In progress")
    ).catch(() => 0),
    SupportTicketModel.countDocuments(matchSupportTicketStatusCaseInsensitive("Resolved")).catch(
      () => 0
    ),
    SupportTicketModel.find({})
      .select({ subject: 1, status: 1, priority: 1, createdAt: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .limit(3)
      .lean()
      .exec()
      .catch(() => []),
    IntakeModel.findOne({ status: "ACTIVE" })
      .select({ name: 1, currentTerm: 1 })
      .sort({ updatedAt: -1 })
      .lean()
      .exec()
      .catch(() => null),
    FacultyModel.find({ isDeleted: { $ne: true } })
      .select({ code: 1, name: 1 })
      .lean()
      .exec()
      .catch(() => []),
    DegreeProgramModel.find({ isDeleted: { $ne: true } })
      .select({ code: 1, name: 1 })
      .lean()
      .exec()
      .catch(() => []),
  ]);

  const facultyNameByCode = new Map(
    faculties.map((item) => [collapseSpaces(item.code), collapseSpaces(item.name)])
  );
  const degreeNameByCode = new Map(
    degrees.map((item) => [collapseSpaces(item.code), collapseSpaces(item.name)])
  );

  const studentsPerFaculty = facultyDistributionRows
    .map((item) => {
      const code = collapseSpaces(item?._id);
      if (!code) {
        return null;
      }

      return {
        label: facultyNameByCode.get(code) || code,
        value: Math.max(0, Number(item?.value) || 0),
        meta: code,
      };
    })
    .filter((item): item is { label: string; value: number; meta: string } => Boolean(item));

  const studentsPerDegree = degreeDistributionRows
    .map((item) => {
      const code = collapseSpaces(item?._id);
      if (!code) {
        return null;
      }

      return {
        label: degreeNameByCode.get(code) || code,
        value: Math.max(0, Number(item?.value) || 0),
        meta: code,
      };
    })
    .filter((item): item is { label: string; value: number; meta: string } => Boolean(item));

  const recentActivity = [
    ...latestStudents.map((item) =>
      createActivityItem(
        `student-${String(item._id ?? item.studentId ?? "")}`,
        `Student record updated for ${collapseSpaces(item.firstName)} ${collapseSpaces(item.lastName)}`.trim(),
        collapseSpaces(item.studentId) || "Student registry record updated.",
        item.updatedAt
      )
    ),
    ...latestLecturers.map((item) =>
      createActivityItem(
        `lecturer-${String(item._id ?? item.email ?? "")}`,
        `Lecturer profile updated`,
        collapseSpaces(item.fullName) || collapseSpaces(item.email) || "Lecturer record updated.",
        item.updatedAt
      )
    ),
    ...latestOfferings.map((item) =>
      createActivityItem(
        `offering-${String(item._id ?? item.moduleCode ?? "")}`,
        `${collapseSpaces(item.moduleCode) || "Module"} offering updated`,
        `${collapseSpaces(item.moduleName) || "Unnamed module"} • ${collapseSpaces(item.intakeName)} ${collapseSpaces(item.termCode)}`.trim(),
        item.updatedAt
      )
    ),
    ...latestIntakes.map((item) =>
      createActivityItem(
        `intake-${String(item._id ?? item.name ?? "")}`,
        `Intake schedule updated`,
        `${collapseSpaces(item.name)} • ${collapseSpaces(item.currentTerm)}`.trim(),
        item.updatedAt
      )
    ),
    ...latestAnnouncements.map((item) =>
      createActivityItem(
        `announcement-${String(item._id ?? item.title ?? "")}`,
        `Announcement published`,
        `${collapseSpaces(item.title)} • ${collapseSpaces(item.targetLabel) || "All users"}`.trim(),
        item.updatedAt || item.createdAt
      )
    ),
  ]
    .filter(
      (
        item
      ): item is {
        id: string;
        title: string;
        detail: string;
        occurredAt: string;
      } => Boolean(item)
    )
    .sort((left, right) => {
      return new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();
    })
    .slice(0, 5);

  const alerts = [
    createAlert(
      "offerings-without-lecturers",
      `${offeringsWithoutLecturers} active offerings without assigned lecturers`,
      "Review module offering allocations and assign a lecturer to each active delivery record.",
      offeringsWithoutLecturers > 0 ? "High" : "Medium"
    ),
    createAlert(
      "enrollments-without-subgroups",
      `${enrollmentsWithoutSubgroup} enrollments without subgroup codes`,
      "Students without subgroup allocation may miss subgroup-targeted timetables and notifications.",
      enrollmentsWithoutSubgroup > 0 ? "High" : "Medium"
    ),
    createAlert(
      "offerings-without-content",
      `${offeringsWithoutContent} active offerings still missing weekly content`,
      "Use weekly content management to publish outline details, resources, and coursework links.",
      offeringsWithoutContent > 0 ? "Medium" : "Medium"
    ),
  ];

  const activeIntakeRecord =
    activeIntake && !Array.isArray(activeIntake)
      ? (activeIntake as Record<string, unknown>)
      : null;

  return NextResponse.json({
    stats: {
      totalStudents,
      activeStudents,
      totalFaculties,
      activeFaculties,
      totalDegreePrograms,
      activeDegreePrograms,
      totalLecturers,
      activeLecturers,
      totalModules,
      totalIntakes,
      activeIntakes,
      activeOfferingCount,
      totalSubgroups: Array.isArray(distinctSubgroups) ? distinctSubgroups.length : 0,
    },
    currentIntake: activeIntakeRecord
      ? {
          name: collapseSpaces(activeIntakeRecord.name),
          currentTerm: collapseSpaces(activeIntakeRecord.currentTerm),
        }
      : null,
    studentsPerFaculty,
    studentsPerDegree,
    recentActivity,
    alerts,
    ticketSummary: {
      total: totalTickets,
      open: openTickets,
      inProgress: inProgressTickets,
      resolved: resolvedTickets,
    },
    recentTickets: latestTickets.map((item) => ({
      id: String(item._id ?? ""),
      subject: collapseSpaces(item.subject),
      status: collapseSpaces(item.status),
      priority: collapseSpaces(item.priority),
      occurredAt: toIsoDate(item.updatedAt || item.createdAt),
    })).filter((item) => Boolean(item.id && item.subject && item.occurredAt)),
  });
}

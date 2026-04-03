import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Enrollment";
import "@/models/IntakeRecord";
import "@/models/LabAssistant";
import "@/models/Lecturer";
import "@/models/Student";
import "@/models/User";
import { connectMongoose } from "@/models/mongoose";
import { EnrollmentModel } from "@/models/Enrollment";
import { IntakeRecordModel } from "@/models/IntakeRecord";
import { LabAssistantModel } from "@/models/LabAssistant";
import { LecturerModel } from "@/models/Lecturer";
import { StudentModel } from "@/models/Student";
import { UserModel } from "@/models/User";
import { toAppRoleFromUserRole, type AppRole } from "@/models/rbac";

interface AudienceInput {
  roles: AppRole[];
  userRoles: string[];
  facultyCodes: string[];
  degreeCodes: string[];
  semesterCodes: string[];
  streamCodes: string[];
  intakeIds: string[];
  subgroupCodes: string[];
}

interface AudienceRecipient {
  userId: string;
  appRole: AppRole;
  userRole: string;
  name: string;
  primaryEmail: string;
  optionalEmail: string;
  facultyCodes: string[];
  degreeCodes: string[];
  semesterCode: string;
  streamCode: string;
  intakeId: string;
  subgroupCode: string;
}

const ALL_APP_ROLES: AppRole[] = [
  "SUPER_ADMIN",
  "LECTURER",
  "LOST_ITEM_STAFF",
  "STUDENT",
];

const ALLOWED_USER_ROLES = new Set([
  "ADMIN",
  "SUPER_ADMIN",
  "LOST_ITEM_ADMIN",
  "LOST_ITEM_STAFF",
  "LECTURER",
  "LAB_ASSISTANT",
  "STUDENT",
]);

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value: unknown) {
  return collapseSpaces(value).toLowerCase();
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) => collapseSpaces(item))
    .filter(Boolean);
}

function asUpperSet(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.toUpperCase())
        .filter(Boolean)
    )
  );
}

function parseAudience(input: unknown): AudienceInput {
  const row = asObject(input);
  const roleCandidates = asUpperSet(asStringArray(row?.roles));
  const roles = roleCandidates.filter(
    (value): value is AppRole =>
      value === "SUPER_ADMIN" ||
      value === "LECTURER" ||
      value === "LOST_ITEM_STAFF" ||
      value === "STUDENT"
  );

  const userRoles = asUpperSet(asStringArray(row?.userRoles)).filter((value) =>
    ALLOWED_USER_ROLES.has(value)
  );

  return {
    roles: roles.length ? roles : [...ALL_APP_ROLES],
    userRoles,
    facultyCodes: asUpperSet(asStringArray(row?.facultyCodes)),
    degreeCodes: asUpperSet(asStringArray(row?.degreeCodes)),
    semesterCodes: asUpperSet(asStringArray(row?.semesterCodes)),
    streamCodes: asUpperSet(asStringArray(row?.streamCodes)),
    intakeIds: asStringArray(row?.intakeIds),
    subgroupCodes: asStringArray(row?.subgroupCodes),
  };
}

function matchCodeList(left: string[], right: string[]) {
  if (!right.length) {
    return true;
  }
  if (!left.length) {
    return false;
  }

  const rightSet = new Set(right.map((value) => value.toUpperCase()));
  return left.some((value) => rightSet.has(value.toUpperCase()));
}

function matchOne(left: string, right: string[]) {
  if (!right.length) {
    return true;
  }
  return Boolean(left) && right.includes(left);
}

function userDisplayName(user: Record<string, unknown>) {
  return (
    collapseSpaces(user.fullName) ||
    collapseSpaces(user.username) ||
    normalizeEmail(user.email) ||
    "User"
  );
}

function mapAppRolesToDbRoles(roles: AppRole[]) {
  const dbRoles = new Set<string>();
  roles.forEach((role) => {
    if (role === "SUPER_ADMIN") {
      dbRoles.add("ADMIN");
      dbRoles.add("SUPER_ADMIN");
      return;
    }
    if (role === "LOST_ITEM_STAFF") {
      dbRoles.add("LOST_ITEM_ADMIN");
      dbRoles.add("LOST_ITEM_STAFF");
      return;
    }
    if (role === "LECTURER") {
      dbRoles.add("LECTURER");
      dbRoles.add("LAB_ASSISTANT");
      return;
    }
    if (role === "STUDENT") {
      dbRoles.add("STUDENT");
    }
  });
  return Array.from(dbRoles);
}

async function authorizeAdmin(request: Request) {
  const headerUserId = collapseSpaces(request.headers.get("x-user-id"));
  if (!headerUserId || !mongoose.Types.ObjectId.isValid(headerUserId)) {
    return null;
  }

  const row = (await UserModel.findById(headerUserId)
    .select({ _id: 1, role: 1, status: 1 })
    .lean()
    .exec()
    .catch(() => null)) as Record<string, unknown> | null;

  if (!row || String(row.status ?? "").trim().toUpperCase() !== "ACTIVE") {
    return null;
  }

  const appRole = toAppRoleFromUserRole(row.role);
  if (appRole !== "SUPER_ADMIN") {
    return null;
  }

  return {
    id: collapseSpaces(row._id),
    role: appRole,
  };
}

function recipientPassesFilters(recipient: AudienceRecipient, audience: AudienceInput) {
  if (!matchCodeList(recipient.facultyCodes, audience.facultyCodes)) {
    return false;
  }
  if (!matchCodeList(recipient.degreeCodes, audience.degreeCodes)) {
    return false;
  }
  if (!matchOne(recipient.semesterCode, audience.semesterCodes)) {
    return false;
  }
  if (!matchOne(recipient.streamCode, audience.streamCodes)) {
    return false;
  }
  if (!matchOne(recipient.intakeId, audience.intakeIds)) {
    return false;
  }
  if (!matchOne(recipient.subgroupCode, audience.subgroupCodes)) {
    return false;
  }
  return true;
}

export async function POST(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }

    const authorized = await authorizeAdmin(request);
    if (!authorized) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json().catch(() => null)) as
      | { audience?: unknown }
      | null;
    const audience = parseAudience(payload?.audience);

    const dbRoles = mapAppRolesToDbRoles(audience.roles);
    const users = (await UserModel.find({
      status: "ACTIVE",
      role: { $in: dbRoles },
    })
      .select({
        _id: 1,
        role: 1,
        fullName: 1,
        username: 1,
        email: 1,
        studentRef: 1,
        lecturerRef: 1,
        labAssistantRef: 1,
      })
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    const userRows = users
      .map((value) => asObject(value))
      .filter((value): value is Record<string, unknown> => Boolean(value));

    const studentRefIds = userRows
      .filter((row) => collapseSpaces(row.role).toUpperCase() === "STUDENT")
      .map((row) => collapseSpaces(row.studentRef))
      .filter((value) => mongoose.Types.ObjectId.isValid(value))
      .map((value) => new mongoose.Types.ObjectId(value));

    const lecturerRefIds = userRows
      .filter((row) => collapseSpaces(row.role).toUpperCase() === "LECTURER")
      .map((row) => collapseSpaces(row.lecturerRef))
      .filter((value) => mongoose.Types.ObjectId.isValid(value))
      .map((value) => new mongoose.Types.ObjectId(value));

    const labAssistantRefIds = userRows
      .filter((row) => collapseSpaces(row.role).toUpperCase() === "LAB_ASSISTANT")
      .map((row) => collapseSpaces(row.labAssistantRef))
      .filter((value) => mongoose.Types.ObjectId.isValid(value))
      .map((value) => new mongoose.Types.ObjectId(value));

    const [studentProfilesRaw, enrollmentRowsRaw, lecturerProfilesRaw, labProfilesRaw] =
      await Promise.all([
        studentRefIds.length
          ? StudentModel.find({
              _id: { $in: studentRefIds },
              status: "ACTIVE",
            })
              .select({
                _id: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
                optionalEmail: 1,
              })
              .lean()
              .exec()
              .catch(() => [])
          : Promise.resolve([]),
        studentRefIds.length
          ? EnrollmentModel.find({
              studentId: { $in: studentRefIds },
              status: "ACTIVE",
            })
              .sort({ updatedAt: -1 })
              .select({
                studentId: 1,
                facultyId: 1,
                degreeProgramId: 1,
                intakeId: 1,
                stream: 1,
                subgroup: 1,
              })
              .lean()
              .exec()
              .catch(() => [])
          : Promise.resolve([]),
        lecturerRefIds.length
          ? LecturerModel.find({
              _id: { $in: lecturerRefIds },
              status: "ACTIVE",
            })
              .select({
                _id: 1,
                fullName: 1,
                email: 1,
                optionalEmail: 1,
                facultyIds: 1,
                degreeProgramIds: 1,
              })
              .lean()
              .exec()
              .catch(() => [])
          : Promise.resolve([]),
        labAssistantRefIds.length
          ? LabAssistantModel.find({
              _id: { $in: labAssistantRefIds },
              status: "ACTIVE",
            })
              .select({
                _id: 1,
                fullName: 1,
                email: 1,
                optionalEmail: 1,
                facultyIds: 1,
                degreeProgramIds: 1,
              })
              .lean()
              .exec()
              .catch(() => [])
          : Promise.resolve([]),
      ]);

    const intakeIds = Array.from(
      new Set(
        (enrollmentRowsRaw as unknown[])
          .map((value) => asObject(value))
          .filter((value): value is Record<string, unknown> => Boolean(value))
          .map((row) => collapseSpaces(row.intakeId))
          .filter(Boolean)
      )
    );

    const intakeRowsRaw = intakeIds.length
      ? await IntakeRecordModel.find({
          id: { $in: intakeIds },
        })
          .select({
            id: 1,
            currentTerm: 1,
          })
          .lean()
          .exec()
          .catch(() => [])
      : [];

    const studentProfileMap = new Map(
      (studentProfilesRaw as unknown[])
        .map((value) => asObject(value))
        .filter((value): value is Record<string, unknown> => Boolean(value))
        .map((row) => [collapseSpaces(row._id), row] as const)
    );

    const latestEnrollmentByStudentId = new Map<string, Record<string, unknown>>();
    (enrollmentRowsRaw as unknown[])
      .map((value) => asObject(value))
      .filter((value): value is Record<string, unknown> => Boolean(value))
      .forEach((row) => {
        const studentId = collapseSpaces(row.studentId);
        if (!studentId || latestEnrollmentByStudentId.has(studentId)) {
          return;
        }
        latestEnrollmentByStudentId.set(studentId, row);
      });

    const intakeTermById = new Map(
      (intakeRowsRaw as unknown[])
        .map((value) => asObject(value))
        .filter((value): value is Record<string, unknown> => Boolean(value))
        .map((row) => [
          collapseSpaces(row.id),
          collapseSpaces(row.currentTerm).toUpperCase(),
        ] as const)
    );

    const lecturerProfileMap = new Map(
      (lecturerProfilesRaw as unknown[])
        .map((value) => asObject(value))
        .filter((value): value is Record<string, unknown> => Boolean(value))
        .map((row) => [collapseSpaces(row._id), row] as const)
    );

    const labProfileMap = new Map(
      (labProfilesRaw as unknown[])
        .map((value) => asObject(value))
        .filter((value): value is Record<string, unknown> => Boolean(value))
        .map((row) => [collapseSpaces(row._id), row] as const)
    );

    const recipients: AudienceRecipient[] = [];

    userRows.forEach((row) => {
      const userId = collapseSpaces(row._id);
      const userRole = collapseSpaces(row.role).toUpperCase();
      const appRole = toAppRoleFromUserRole(userRole);
      if (!userId || !audience.roles.includes(appRole)) {
        return;
      }
      if (audience.userRoles.length && !audience.userRoles.includes(userRole)) {
        return;
      }

      let name = userDisplayName(row);
      let primaryEmail = normalizeEmail(row.email);
      let optionalEmail = "";
      let facultyCodes: string[] = [];
      let degreeCodes: string[] = [];
      let semesterCode = "";
      let streamCode = "";
      let intakeId = "";
      let subgroupCode = "";

      if (userRole === "STUDENT") {
        const studentRefId = collapseSpaces(row.studentRef);
        const studentProfile = studentProfileMap.get(studentRefId) ?? null;
        const enrollment = latestEnrollmentByStudentId.get(studentRefId) ?? null;

        if (studentProfile) {
          const fullName = `${collapseSpaces(studentProfile.firstName)} ${collapseSpaces(
            studentProfile.lastName
          )}`.trim();
          if (fullName) {
            name = fullName;
          }
          primaryEmail = normalizeEmail(studentProfile.email) || primaryEmail;
          optionalEmail = normalizeEmail(studentProfile.optionalEmail);
        }

        if (enrollment) {
          const facultyCode = collapseSpaces(enrollment.facultyId).toUpperCase();
          const degreeCode = collapseSpaces(enrollment.degreeProgramId).toUpperCase();
          intakeId = collapseSpaces(enrollment.intakeId);
          streamCode = collapseSpaces(enrollment.stream).toUpperCase();
          subgroupCode = collapseSpaces(enrollment.subgroup);
          facultyCodes = facultyCode ? [facultyCode] : [];
          degreeCodes = degreeCode ? [degreeCode] : [];
          if (intakeId) {
            semesterCode = intakeTermById.get(intakeId) ?? "";
          }
        }
      } else if (userRole === "LECTURER") {
        const lecturerRefId = collapseSpaces(row.lecturerRef);
        const lecturerProfile = lecturerProfileMap.get(lecturerRefId) ?? null;
        if (lecturerProfile) {
          name = collapseSpaces(lecturerProfile.fullName) || name;
          primaryEmail = normalizeEmail(lecturerProfile.email) || primaryEmail;
          optionalEmail = normalizeEmail(lecturerProfile.optionalEmail);
          facultyCodes = asUpperSet(asStringArray(lecturerProfile.facultyIds));
          degreeCodes = asUpperSet(asStringArray(lecturerProfile.degreeProgramIds));
        }
      } else if (userRole === "LAB_ASSISTANT") {
        const labRefId = collapseSpaces(row.labAssistantRef);
        const labProfile = labProfileMap.get(labRefId) ?? null;
        if (labProfile) {
          name = collapseSpaces(labProfile.fullName) || name;
          primaryEmail = normalizeEmail(labProfile.email) || primaryEmail;
          optionalEmail = normalizeEmail(labProfile.optionalEmail);
          facultyCodes = asUpperSet(asStringArray(labProfile.facultyIds));
          degreeCodes = asUpperSet(asStringArray(labProfile.degreeProgramIds));
        }
      }

      const recipient: AudienceRecipient = {
        userId,
        appRole,
        userRole,
        name,
        primaryEmail,
        optionalEmail,
        facultyCodes,
        degreeCodes,
        semesterCode,
        streamCode,
        intakeId,
        subgroupCode,
      };

      if (!recipientPassesFilters(recipient, audience)) {
        return;
      }

      recipients.push(recipient);
    });

    recipients.sort((left, right) =>
      `${left.name} ${left.userId}`.localeCompare(`${right.name} ${right.userId}`)
    );

    return NextResponse.json({
      recipients,
      total: recipients.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to resolve target audience",
      },
      { status: 500 }
    );
  }
}

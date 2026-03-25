import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Enrollment";
import "@/models/Grade";
import "@/models/ModuleOffering";
import "@/models/Student";
import "@/models/User";
import {
  createGradeInMemory,
  findGradeInMemoryByStudentOffering,
  listGradesInMemory,
} from "@/lib/grade-store";
import { calculateFullGrade, type GradeStatus } from "@/lib/grade-utils";
import { findLecturerInMemoryById } from "@/lib/lecturer-store";
import { connectMongoose } from "@/lib/mongoose";
import { findModuleOfferingById } from "@/lib/module-offering-store";
import { findModuleById } from "@/lib/module-store";
import {
  findStudentInMemoryById,
  isMongoDuplicateKeyError,
  listEnrollmentRecordsInMemory,
} from "@/lib/student-registration";
import { EnrollmentModel } from "@/models/Enrollment";
import { GradeModel } from "@/models/Grade";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { StudentModel } from "@/models/Student";
import { UserModel } from "@/models/User";

const GRADE_STATUS_VALUES: GradeStatus[] = ["pass", "fail", "pro-rata", "repeat"];

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toIsoDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString();
}

function sanitizeAcademicYear(value: unknown) {
  return collapseSpaces(value).slice(0, 32);
}

function sanitizeSemester(value: unknown): 1 | 2 | null {
  const parsed = Number(value);
  if (parsed === 1 || parsed === 2) {
    return parsed;
  }

  return null;
}

function sanitizeStatus(value: string | null): "" | GradeStatus {
  if (
    value === "pass" ||
    value === "fail" ||
    value === "pro-rata" ||
    value === "repeat"
  ) {
    return value;
  }

  return "";
}

function sanitizeMarks(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }

  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function sanitizeRemarks(value: unknown) {
  return collapseSpaces(value).slice(0, 1000);
}

function parseOptionalObjectId(value: unknown) {
  if (value === undefined) {
    return { provided: false, invalid: false, value: null as string | null };
  }

  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return { provided: true, invalid: false, value: null as string | null };
  }

  if (!mongoose.Types.ObjectId.isValid(normalized)) {
    return { provided: true, invalid: true, value: null as string | null };
  }

  return { provided: true, invalid: false, value: normalized };
}

function readId(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (typeof value === "object") {
    const row = value as {
      _id?: unknown;
      id?: unknown;
      toString?: () => string;
    };
    const nestedId = String(row._id ?? row.id ?? "").trim();
    if (nestedId) {
      return nestedId;
    }

    const rendered = typeof row.toString === "function" ? row.toString() : "";
    return rendered === "[object Object]" ? "" : rendered.trim();
  }

  return "";
}

function toApiGrade(row: unknown) {
  const doc = asObject(row);
  if (!doc) {
    return null;
  }

  const id = String(doc._id ?? doc.id ?? "").trim();
  if (!id) {
    return null;
  }

  const student = asObject(doc.studentId);
  const offering = asObject(doc.moduleOfferingId);
  const gradedBy = asObject(doc.gradedBy);
  const studentRecordId = readId(doc.studentId);
  const offeringRecordId = readId(doc.moduleOfferingId);
  const graderId = readId(doc.gradedBy);
  const memoryStudent = !student && studentRecordId ? findStudentInMemoryById(studentRecordId) : null;
  const memoryOffering =
    !offering && offeringRecordId ? findModuleOfferingById(offeringRecordId) : null;
  const memoryLecturer = !gradedBy && graderId ? findLecturerInMemoryById(graderId) : null;
  const moduleId = String(offering?.moduleId ?? memoryOffering?.moduleId ?? "").trim();
  const moduleRecord = moduleId ? findModuleById(moduleId) : null;
  const firstName = collapseSpaces(student?.firstName ?? memoryStudent?.firstName);
  const lastName = collapseSpaces(student?.lastName ?? memoryStudent?.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    id,
    _id: id,
    studentId: student || memoryStudent
      ? {
          _id: studentRecordId || null,
          id: studentRecordId || null,
          studentId: collapseSpaces(student?.studentId ?? memoryStudent?.studentId),
          registrationNumber: collapseSpaces(
            student?.studentId ?? memoryStudent?.studentId
          ),
          firstName,
          lastName,
          fullName,
        }
      : null,
    moduleOfferingId: offering || memoryOffering
      ? {
          _id: offeringRecordId || null,
          id: offeringRecordId || null,
          moduleId,
          moduleCode: collapseSpaces(
            offering?.moduleCode ?? memoryOffering?.moduleCode ?? moduleRecord?.code
          ),
          moduleName: collapseSpaces(
            offering?.moduleName ?? memoryOffering?.moduleName ?? moduleRecord?.name
          ),
          intakeId: collapseSpaces(offering?.intakeId ?? memoryOffering?.intakeId),
          termCode: collapseSpaces(offering?.termCode ?? memoryOffering?.termCode),
          status: collapseSpaces(offering?.status ?? memoryOffering?.status),
        }
      : null,
    caMarks: Number(doc.caMarks ?? 0),
    finalExamMarks: Number(doc.finalExamMarks ?? 0),
    totalMarks: Number(doc.totalMarks ?? 0),
    gradeLetter: collapseSpaces(doc.gradeLetter),
    gradePoint: Number(doc.gradePoint ?? 0),
    status: collapseSpaces(doc.status),
    academicYear: collapseSpaces(doc.academicYear),
    semester: Number(doc.semester ?? 0),
    gradedBy: gradedBy || memoryLecturer || graderId
      ? {
          _id: graderId || null,
          id: graderId || null,
          username: collapseSpaces(
            gradedBy?.username ?? memoryLecturer?.email ?? graderId
          ),
          name: collapseSpaces(
            gradedBy?.username ?? memoryLecturer?.fullName ?? graderId
          ),
          email: collapseSpaces(gradedBy?.email ?? memoryLecturer?.email).toLowerCase(),
          role: collapseSpaces(gradedBy?.role ?? (memoryLecturer ? "LECTURER" : "")),
        }
      : null,
    gradedAt: toIsoDate(doc.gradedAt) || null,
    remarks: sanitizeRemarks(doc.remarks),
    createdAt: toIsoDate(doc.createdAt),
    updatedAt: toIsoDate(doc.updatedAt),
  };
}

async function findGradeByIdWithDetails(gradeId: string) {
  const row = await GradeModel.findById(gradeId)
    .populate({ path: "studentId", select: "studentId firstName lastName" })
    .populate({
      path: "moduleOfferingId",
      select: "moduleId intakeId termCode status degreeProgramId facultyId",
    })
    .populate({ path: "gradedBy", select: "username email role" })
    .lean()
    .exec()
    .catch(() => null);

  if (!row) {
    return null;
  }

  return toApiGrade(row);
}

async function isStudentEnrolledInOffering(studentId: string, offering: unknown) {
  const row = asObject(offering);
  const intakeId = collapseSpaces(row?.intakeId);
  const degreeProgramId = collapseSpaces(row?.degreeProgramId).toUpperCase();

  if (!studentId || !intakeId || !degreeProgramId) {
    return false;
  }

  return Boolean(
    await EnrollmentModel.exists({
      studentId,
      intakeId,
      degreeProgramId,
      status: "ACTIVE",
    }).catch(() => null)
  );
}

function isStudentEnrolledInOfferingInMemory(studentId: string, offering: unknown) {
  const row = asObject(offering);
  const intakeId = collapseSpaces(row?.intakeId);
  const degreeProgramId = collapseSpaces(row?.degreeProgramId).toUpperCase();

  if (!studentId || !intakeId || !degreeProgramId) {
    return false;
  }

  return listEnrollmentRecordsInMemory({
    studentId,
    intakeId,
    degreeProgramId,
    status: "ACTIVE",
  }).length > 0;
}

export async function GET(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);

    const { searchParams } = new URL(request.url);
    const studentId = String(searchParams.get("studentId") ?? "").trim();
    const moduleOfferingId = String(searchParams.get("moduleOfferingId") ?? "").trim();
    const academicYear = sanitizeAcademicYear(searchParams.get("academicYear"));
    const semesterParam = searchParams.get("semester");
    const semester =
      semesterParam === null ? null : sanitizeSemester(searchParams.get("semester"));
    const statusParam = searchParams.get("status");
    const status =
      statusParam === null ? "" : sanitizeStatus(searchParams.get("status"));

    if (mongooseConnection && studentId && !mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid studentId filter" },
        { status: 400 }
      );
    }

    if (
      mongooseConnection &&
      moduleOfferingId &&
      !mongoose.Types.ObjectId.isValid(moduleOfferingId)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid moduleOfferingId filter" },
        { status: 400 }
      );
    }

    if (semesterParam !== null && semester === null) {
      return NextResponse.json(
        { success: false, error: "Semester must be 1 or 2" },
        { status: 400 }
      );
    }

    if (statusParam !== null && !status) {
      return NextResponse.json(
        {
          success: false,
          error: `Status must be one of: ${GRADE_STATUS_VALUES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const query: Record<string, unknown> = {};
    if (studentId) {
      query.studentId = studentId;
    }
    if (moduleOfferingId) {
      query.moduleOfferingId = moduleOfferingId;
    }
    if (academicYear) {
      query.academicYear = academicYear;
    }
    if (semester !== null) {
      query.semester = semester;
    }
    if (status) {
      query.status = status;
    }

    if (!mongooseConnection) {
      const grades = listGradesInMemory({
        studentId,
        moduleOfferingId,
        academicYear,
        semester,
        status,
      })
        .map((row) => toApiGrade(row))
        .filter(Boolean);

      return NextResponse.json({
        success: true,
        data: grades,
      });
    }

    const rows = (await GradeModel.find(query)
      .populate({ path: "studentId", select: "studentId firstName lastName" })
      .populate({
        path: "moduleOfferingId",
        select: "moduleId intakeId termCode status degreeProgramId facultyId",
      })
      .populate({ path: "gradedBy", select: "username email role" })
      .sort({ createdAt: -1 })
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    const grades = rows.map((row) => toApiGrade(row)).filter(Boolean);

    return NextResponse.json({
      success: true,
      data: grades,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch grades",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);

    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};

    const studentId = String(body.studentId ?? "").trim();
    const moduleOfferingId = String(body.moduleOfferingId ?? "").trim();
    const academicYear = sanitizeAcademicYear(body.academicYear);
    const semester = sanitizeSemester(body.semester);
    const caMarks = sanitizeMarks(body.caMarks);
    const finalExamMarks = sanitizeMarks(body.finalExamMarks);
    const rawGradedBy = collapseSpaces(body.gradedBy);
    const gradedBy = parseOptionalObjectId(body.gradedBy);
    const remarks = sanitizeRemarks(body.remarks);

    if (!studentId || (mongooseConnection && !mongoose.Types.ObjectId.isValid(studentId))) {
      return NextResponse.json(
        { success: false, error: "Valid studentId is required" },
        { status: 400 }
      );
    }

    if (
      !moduleOfferingId ||
      (mongooseConnection && !mongoose.Types.ObjectId.isValid(moduleOfferingId))
    ) {
      return NextResponse.json(
        { success: false, error: "Valid moduleOfferingId is required" },
        { status: 400 }
      );
    }

    if (caMarks === null) {
      return NextResponse.json(
        { success: false, error: "CA marks must be a number between 0 and 100" },
        { status: 400 }
      );
    }

    if (finalExamMarks === null) {
      return NextResponse.json(
        {
          success: false,
          error: "Final exam marks must be a number between 0 and 100",
        },
        { status: 400 }
      );
    }

    if (!academicYear) {
      return NextResponse.json(
        { success: false, error: "Academic year is required" },
        { status: 400 }
      );
    }

    if (semester === null) {
      return NextResponse.json(
        { success: false, error: "Semester must be 1 or 2" },
        { status: 400 }
      );
    }

    if (mongooseConnection && gradedBy.invalid) {
      return NextResponse.json(
        { success: false, error: "gradedBy must be a valid user id" },
        { status: 400 }
      );
    }

    if (!mongooseConnection) {
      const student = findStudentInMemoryById(studentId);
      if (!student) {
        return NextResponse.json(
          { success: false, error: "Student not found" },
          { status: 400 }
        );
      }

      const offering = findModuleOfferingById(moduleOfferingId);
      if (!offering) {
        return NextResponse.json(
          { success: false, error: "Module offering not found" },
          { status: 400 }
        );
      }

      if (findGradeInMemoryByStudentOffering(studentId, moduleOfferingId)) {
        return NextResponse.json(
          {
            success: false,
            error: "Grade already exists for this student in this module offering",
          },
          { status: 409 }
        );
      }

      if (!isStudentEnrolledInOfferingInMemory(studentId, offering)) {
        return NextResponse.json(
          {
            success: false,
            error: "Student is not enrolled in this module offering",
          },
          { status: 400 }
        );
      }

      const calculated = calculateFullGrade(caMarks, finalExamMarks);
      const created = createGradeInMemory({
        studentId,
        moduleOfferingId,
        caMarks,
        finalExamMarks,
        totalMarks: calculated.totalMarks,
        gradeLetter: calculated.gradeLetter,
        gradePoint: calculated.gradePoint,
        status: calculated.status,
        academicYear,
        semester,
        gradedBy: rawGradedBy || null,
        gradedAt: new Date().toISOString(),
        remarks,
      });

      return NextResponse.json(
        {
          success: true,
          data: toApiGrade(created),
        },
        { status: 201 }
      );
    }

    const studentExists = Boolean(
      await StudentModel.exists({ _id: studentId }).catch(() => null)
    );
    if (!studentExists) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 400 }
      );
    }

    const offering = await ModuleOfferingModel.findById(moduleOfferingId)
      .lean()
      .exec()
      .catch(() => null);
    if (!offering) {
      return NextResponse.json(
        { success: false, error: "Module offering not found" },
        { status: 400 }
      );
    }

    if (gradedBy.value) {
      const gradedByUser = await UserModel.findById(gradedBy.value)
        .select("role")
        .lean()
        .exec()
        .catch(() => null);
      const gradedByRecord = asObject(gradedByUser);
      const gradedByRole = collapseSpaces(gradedByRecord?.role).toUpperCase();

      if (!gradedByRecord) {
        return NextResponse.json(
          { success: false, error: "Graded by user not found" },
          { status: 400 }
        );
      }

      if (gradedByRole !== "ADMIN" && gradedByRole !== "LECTURER") {
        return NextResponse.json(
          {
            success: false,
            error: "gradedBy user must have an ADMIN or LECTURER role",
          },
          { status: 400 }
        );
      }
    }

    const enrolled = await isStudentEnrolledInOffering(studentId, offering);
    if (!enrolled) {
      return NextResponse.json(
        {
          success: false,
          error: "Student is not enrolled in this module offering",
        },
        { status: 400 }
      );
    }

    const duplicate = Boolean(
      await GradeModel.exists({ studentId, moduleOfferingId }).catch(() => null)
    );
    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          error: "Grade already exists for this student in this module offering",
        },
        { status: 409 }
      );
    }

    const calculated = calculateFullGrade(caMarks, finalExamMarks);

    let createdId = "";
    try {
      const created = await GradeModel.create({
        studentId,
        moduleOfferingId,
        caMarks,
        finalExamMarks,
        totalMarks: calculated.totalMarks,
        gradeLetter: calculated.gradeLetter,
        gradePoint: calculated.gradePoint,
        status: calculated.status,
        academicYear,
        semester,
        gradedBy: gradedBy.value,
        gradedAt: new Date(),
        remarks,
      });
      createdId = String(created._id ?? "").trim();
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        return NextResponse.json(
          {
            success: false,
            error: "Grade already exists for this student in this module offering",
          },
          { status: 409 }
        );
      }

      throw error;
    }

    await ModuleOfferingModel.updateOne(
      { _id: moduleOfferingId },
      { $set: { hasGrades: true } }
    ).catch(() => null);

    const createdGrade = createdId ? await findGradeByIdWithDetails(createdId) : null;
    if (!createdGrade) {
      return NextResponse.json(
        { success: false, error: "Failed to map created grade" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: createdGrade,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create grade",
      },
      { status: 500 }
    );
  }
}

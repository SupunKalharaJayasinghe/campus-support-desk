import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Enrollment";
import "@/models/Grade";
import "@/models/ModuleOffering";
import "@/models/Student";
import "@/models/User";
import { calculateFullGrade } from "@/lib/grade-utils";
import { connectMongoose } from "@/lib/mongoose";
import { EnrollmentModel } from "@/models/Enrollment";
import { GradeModel } from "@/models/Grade";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { StudentModel } from "@/models/Student";
import { UserModel } from "@/models/User";

interface BulkGradeRow {
  studentId: string;
  caMarks: number;
  finalExamMarks: number;
  remarks: string;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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

function extractIdSet(rows: unknown[], key: "_id" | "studentId") {
  return new Set(
    rows
      .map((row) => {
        const doc = asObject(row);
        return readId(doc?.[key]);
      })
      .filter(Boolean)
  );
}

export async function POST(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { success: false, error: "Database connection is not configured" },
        { status: 503 }
      );
    }

    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};

    const moduleOfferingId = String(body.moduleOfferingId ?? "").trim();
    const academicYear = sanitizeAcademicYear(body.academicYear);
    const semester = sanitizeSemester(body.semester);
    const gradedBy = parseOptionalObjectId(body.gradedBy);
    const gradeRows = Array.isArray(body.grades) ? body.grades : null;

    if (!moduleOfferingId || !mongoose.Types.ObjectId.isValid(moduleOfferingId)) {
      return NextResponse.json(
        { success: false, error: "Valid moduleOfferingId is required" },
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

    if (gradedBy.invalid) {
      return NextResponse.json(
        { success: false, error: "gradedBy must be a valid user id" },
        { status: 400 }
      );
    }

    if (!gradeRows || gradeRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one grade row is required" },
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
      const gradedByExists = Boolean(
        await UserModel.exists({ _id: gradedBy.value }).catch(() => null)
      );
      if (!gradedByExists) {
        return NextResponse.json(
          { success: false, error: "Graded by user not found" },
          { status: 400 }
        );
      }
    }

    const parsedRows: BulkGradeRow[] = [];
    const seenStudentIds = new Set<string>();

    for (let index = 0; index < gradeRows.length; index += 1) {
      const rawRow = asObject(gradeRows[index]);
      if (!rawRow) {
        return NextResponse.json(
          {
            success: false,
            error: `Grade row ${index + 1} must be an object`,
          },
          { status: 400 }
        );
      }

      const studentId = String(rawRow.studentId ?? "").trim();
      const caMarks = sanitizeMarks(rawRow.caMarks);
      const finalExamMarks = sanitizeMarks(rawRow.finalExamMarks);
      const remarks = sanitizeRemarks(rawRow.remarks);

      if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
        return NextResponse.json(
          {
            success: false,
            error: `Valid studentId is required for grade row ${index + 1}`,
          },
          { status: 400 }
        );
      }

      if (caMarks === null) {
        return NextResponse.json(
          {
            success: false,
            error: `CA marks must be between 0 and 100 for grade row ${index + 1}`,
          },
          { status: 400 }
        );
      }

      if (finalExamMarks === null) {
        return NextResponse.json(
          {
            success: false,
            error: `Final exam marks must be between 0 and 100 for grade row ${index + 1}`,
          },
          { status: 400 }
        );
      }

      if (seenStudentIds.has(studentId)) {
        return NextResponse.json(
          {
            success: false,
            error: "Duplicate studentId entries are not allowed in bulk grades",
          },
          { status: 400 }
        );
      }

      seenStudentIds.add(studentId);
      parsedRows.push({
        studentId,
        caMarks,
        finalExamMarks,
        remarks,
      });
    }

    const studentObjectIds = parsedRows.map((row) => new mongoose.Types.ObjectId(row.studentId));
    const studentRows = (await StudentModel.find({
      _id: { $in: studentObjectIds },
    })
      .select("_id")
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    const foundStudentIds = extractIdSet(studentRows, "_id");
    const missingStudentId = parsedRows.find((row) => !foundStudentIds.has(row.studentId));
    if (missingStudentId) {
      return NextResponse.json(
        { success: false, error: `Student not found: ${missingStudentId.studentId}` },
        { status: 400 }
      );
    }

    const offeringRow = asObject(offering);
    const intakeId = collapseSpaces(offeringRow?.intakeId);
    const degreeProgramId = collapseSpaces(offeringRow?.degreeProgramId).toUpperCase();
    const enrolledRows = (await EnrollmentModel.find({
      studentId: { $in: studentObjectIds },
      intakeId,
      degreeProgramId,
      status: "ACTIVE",
    })
      .select("studentId")
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    const enrolledStudentIds = extractIdSet(enrolledRows, "studentId");
    const notEnrolledStudentId = parsedRows.find(
      (row) => !enrolledStudentIds.has(row.studentId)
    );
    if (notEnrolledStudentId) {
      return NextResponse.json(
        {
          success: false,
          error: `Student is not enrolled in this module offering: ${notEnrolledStudentId.studentId}`,
        },
        { status: 400 }
      );
    }

    const existingRows = (await GradeModel.find({
      moduleOfferingId,
      studentId: { $in: studentObjectIds },
    })
      .select("studentId")
      .lean()
      .exec()
      .catch(() => [])) as unknown[];

    const existingStudentIds = extractIdSet(existingRows, "studentId");
    const created = parsedRows.filter((row) => !existingStudentIds.has(row.studentId)).length;
    const updated = parsedRows.length - created;
    const gradedAt = new Date();
    const moduleOfferingObjectId = new mongoose.Types.ObjectId(moduleOfferingId);
    const gradedByObjectId = gradedBy.value
      ? new mongoose.Types.ObjectId(gradedBy.value)
      : null;

    await GradeModel.bulkWrite(
      parsedRows.map((row) => {
        const calculated = calculateFullGrade(row.caMarks, row.finalExamMarks);
        const studentObjectId = new mongoose.Types.ObjectId(row.studentId);

        return {
          updateOne: {
            filter: {
              studentId: studentObjectId,
              moduleOfferingId: moduleOfferingObjectId,
            },
            update: {
              $set: {
                academicYear,
                semester,
                caMarks: row.caMarks,
                finalExamMarks: row.finalExamMarks,
                totalMarks: calculated.totalMarks,
                gradeLetter: calculated.gradeLetter,
                gradePoint: calculated.gradePoint,
                status: calculated.status,
                gradedBy: gradedByObjectId,
                gradedAt,
                remarks: row.remarks,
              },
              $setOnInsert: {
                studentId: studentObjectId,
                moduleOfferingId: moduleOfferingObjectId,
              },
            },
            upsert: true,
          },
        };
      }),
      { ordered: false }
    );

    await ModuleOfferingModel.updateOne(
      { _id: moduleOfferingId },
      { $set: { hasGrades: true } }
    ).catch(() => null);

    return NextResponse.json({
      success: true,
      data: {
        created,
        updated,
        total: parsedRows.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to bulk save grades",
      },
      { status: 500 }
    );
  }
}

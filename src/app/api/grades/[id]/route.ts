import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Grade";
import "@/models/ModuleOffering";
import "@/models/Student";
import "@/models/User";
import { calculateFullGrade } from "@/lib/grade-utils";
import { connectMongoose } from "@/lib/mongoose";
import { findModuleById } from "@/lib/module-store";
import { GradeModel } from "@/models/Grade";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { UserModel } from "@/models/User";

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
  const moduleId = String(offering?.moduleId ?? "").trim();
  const moduleRecord = moduleId ? findModuleById(moduleId) : null;
  const firstName = collapseSpaces(student?.firstName);
  const lastName = collapseSpaces(student?.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const studentRecordId = String(student?._id ?? student?.id ?? "").trim();
  const offeringRecordId = String(offering?._id ?? offering?.id ?? "").trim();
  const graderId = String(gradedBy?._id ?? gradedBy?.id ?? "").trim();

  return {
    id,
    _id: id,
    studentId: student
      ? {
          _id: studentRecordId || null,
          id: studentRecordId || null,
          studentId: collapseSpaces(student.studentId),
          registrationNumber: collapseSpaces(student.studentId),
          firstName,
          lastName,
          fullName,
        }
      : null,
    moduleOfferingId: offering
      ? {
          _id: offeringRecordId || null,
          id: offeringRecordId || null,
          moduleId,
          moduleCode: moduleRecord?.code ?? "",
          moduleName: moduleRecord?.name ?? "",
          intakeId: collapseSpaces(offering.intakeId),
          termCode: collapseSpaces(offering.termCode),
          status: collapseSpaces(offering.status),
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
    gradedBy: gradedBy
      ? {
          _id: graderId || null,
          id: graderId || null,
          username: collapseSpaces(gradedBy.username),
          name: collapseSpaces(gradedBy.username),
          email: collapseSpaces(gradedBy.email).toLowerCase(),
          role: collapseSpaces(gradedBy.role),
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

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { success: false, error: "Database connection is not configured" },
        { status: 503 }
      );
    }

    const gradeId = String(params.id ?? "").trim();
    if (!gradeId) {
      return NextResponse.json(
        { success: false, error: "Grade id is required" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(gradeId)) {
      return NextResponse.json(
        { success: false, error: "Grade not found" },
        { status: 404 }
      );
    }

    const grade = await findGradeByIdWithDetails(gradeId);
    if (!grade) {
      return NextResponse.json(
        { success: false, error: "Grade not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: grade,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch grade",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { success: false, error: "Database connection is not configured" },
        { status: 503 }
      );
    }

    const gradeId = String(params.id ?? "").trim();
    if (!gradeId) {
      return NextResponse.json(
        { success: false, error: "Grade id is required" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(gradeId)) {
      return NextResponse.json(
        { success: false, error: "Grade not found" },
        { status: 404 }
      );
    }

    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};

    const hasCaMarks = Object.prototype.hasOwnProperty.call(body, "caMarks");
    const hasFinalExamMarks = Object.prototype.hasOwnProperty.call(
      body,
      "finalExamMarks"
    );
    const hasRemarks = Object.prototype.hasOwnProperty.call(body, "remarks");

    const caMarks = hasCaMarks ? sanitizeMarks(body.caMarks) : undefined;
    const finalExamMarks = hasFinalExamMarks
      ? sanitizeMarks(body.finalExamMarks)
      : undefined;
    const gradedBy = parseOptionalObjectId(body.gradedBy);
    const remarks = hasRemarks ? sanitizeRemarks(body.remarks) : undefined;

    if (hasCaMarks && caMarks === null) {
      return NextResponse.json(
        { success: false, error: "CA marks must be a number between 0 and 100" },
        { status: 400 }
      );
    }

    if (hasFinalExamMarks && finalExamMarks === null) {
      return NextResponse.json(
        {
          success: false,
          error: "Final exam marks must be a number between 0 and 100",
        },
        { status: 400 }
      );
    }

    if (gradedBy.invalid) {
      return NextResponse.json(
        { success: false, error: "gradedBy must be a valid user id" },
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

    const current = await GradeModel.findById(gradeId).exec();
    if (!current) {
      return NextResponse.json(
        { success: false, error: "Grade not found" },
        { status: 404 }
      );
    }

    const shouldRecalculate = hasCaMarks || hasFinalExamMarks;

    if (caMarks !== undefined && caMarks !== null) {
      current.caMarks = caMarks;
    }
    if (finalExamMarks !== undefined && finalExamMarks !== null) {
      current.finalExamMarks = finalExamMarks;
    }
    if (remarks !== undefined) {
      current.remarks = remarks;
    }
    if (gradedBy.provided) {
      current.gradedBy = gradedBy.value
        ? new mongoose.Types.ObjectId(gradedBy.value)
        : null;
      current.gradedAt = new Date();
    }

    if (shouldRecalculate) {
      const calculated = calculateFullGrade(current.caMarks, current.finalExamMarks);
      current.totalMarks = calculated.totalMarks;
      current.gradeLetter = calculated.gradeLetter;
      current.gradePoint = calculated.gradePoint;
      current.status = calculated.status;
      current.gradedAt = new Date();
    }

    await current.save();

    await ModuleOfferingModel.updateOne(
      { _id: current.moduleOfferingId },
      { $set: { hasGrades: true } }
    ).catch(() => null);

    const updatedGrade = await findGradeByIdWithDetails(gradeId);
    if (!updatedGrade) {
      return NextResponse.json(
        { success: false, error: "Failed to map updated grade" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedGrade,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update grade",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    if (!mongooseConnection) {
      return NextResponse.json(
        { success: false, error: "Database connection is not configured" },
        { status: 503 }
      );
    }

    const gradeId = String(params.id ?? "").trim();
    if (!gradeId) {
      return NextResponse.json(
        { success: false, error: "Grade id is required" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(gradeId)) {
      return NextResponse.json(
        { success: false, error: "Grade not found" },
        { status: 404 }
      );
    }

    const current = await GradeModel.findById(gradeId)
      .select("_id moduleOfferingId")
      .lean()
      .exec()
      .catch(() => null);
    if (!current) {
      return NextResponse.json(
        { success: false, error: "Grade not found" },
        { status: 404 }
      );
    }

    const row = current as { moduleOfferingId?: unknown };
    const offeringId = collapseSpaces(row.moduleOfferingId);

    await GradeModel.deleteOne({ _id: gradeId }).catch(() => null);

    if (offeringId) {
      const hasRemainingGrades = Boolean(
        await GradeModel.exists({ moduleOfferingId: offeringId }).catch(() => null)
      );

      if (!hasRemainingGrades) {
        await ModuleOfferingModel.updateOne(
          { _id: offeringId },
          { $set: { hasGrades: false } }
        ).catch(() => null);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Grade deleted successfully",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete grade",
      },
      { status: 500 }
    );
  }
}

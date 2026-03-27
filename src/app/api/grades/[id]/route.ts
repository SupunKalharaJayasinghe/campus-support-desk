import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Grade";
import "@/models/ModuleOffering";
import "@/models/Student";
import "@/models/User";
import {
  deleteGradeInMemory,
  findGradeInMemoryById,
  updateGradeInMemory,
} from "@/lib/grade-store";
import { calculateFullGrade } from "@/lib/grade-utils";
import { findLecturerInMemoryById } from "@/lib/lecturer-store";
import { connectMongoose } from "@/lib/mongoose";
import { findModuleOfferingById } from "@/lib/module-offering-store";
import { findModuleById } from "@/lib/module-store";
import {
  awardPointsForGrade,
  revokePointsForGrade,
} from "@/lib/points-engine";
import { findStudentInMemoryById } from "@/lib/student-registration";
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

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);

    const gradeId = String(params.id ?? "").trim();
    if (!gradeId) {
      return NextResponse.json(
        { success: false, error: "Grade id is required" },
        { status: 400 }
      );
    }

    if (!mongooseConnection) {
      const grade = findGradeInMemoryById(gradeId);
      if (!grade) {
        return NextResponse.json(
          { success: false, error: "Grade not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: toApiGrade(grade),
      });
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

    const gradeId = String(params.id ?? "").trim();
    if (!gradeId) {
      return NextResponse.json(
        { success: false, error: "Grade id is required" },
        { status: 400 }
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
    const rawGradedBy = collapseSpaces(body.gradedBy);
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

    if (mongooseConnection && gradedBy.invalid) {
      return NextResponse.json(
        { success: false, error: "gradedBy must be a valid user id" },
        { status: 400 }
      );
    }

    if (!mongooseConnection) {
      const current = findGradeInMemoryById(gradeId);
      if (!current) {
        return NextResponse.json(
          { success: false, error: "Grade not found" },
          { status: 404 }
        );
      }

      const nextCaMarks = caMarks ?? current.caMarks;
      const nextFinalExamMarks = finalExamMarks ?? current.finalExamMarks;
      const shouldRecalculate = hasCaMarks || hasFinalExamMarks;
      const calculated = shouldRecalculate
        ? calculateFullGrade(nextCaMarks, nextFinalExamMarks)
        : null;

      const updated = updateGradeInMemory(gradeId, {
        caMarks: nextCaMarks,
        finalExamMarks: nextFinalExamMarks,
        totalMarks: calculated?.totalMarks ?? current.totalMarks,
        gradeLetter: calculated?.gradeLetter ?? current.gradeLetter,
        gradePoint: calculated?.gradePoint ?? current.gradePoint,
        status: calculated?.status ?? current.status,
        remarks: remarks ?? current.remarks,
        gradedBy: gradedBy.provided ? rawGradedBy || null : current.gradedBy,
        gradedAt:
          shouldRecalculate || gradedBy.provided
            ? new Date().toISOString()
            : current.gradedAt,
      });

      if (!updated) {
        return NextResponse.json(
          { success: false, error: "Grade not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: toApiGrade(updated),
      });
    }

    if (!mongoose.Types.ObjectId.isValid(gradeId)) {
      return NextResponse.json(
        { success: false, error: "Grade not found" },
        { status: 404 }
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

    let xpAwarded: Awaited<ReturnType<typeof awardPointsForGrade>> | null = null;
    if (shouldRecalculate) {
      try {
        const revokeResult = await revokePointsForGrade(gradeId, "Grade updated");
        if (!revokeResult.success) {
          console.error("Failed to revoke points for updated grade", {
            gradeId,
          });
        }

        const awardResult = await awardPointsForGrade(gradeId);
        if (
          awardResult.pointsAwarded.length > 0 ||
          awardResult.milestonesUnlocked.length > 0 ||
          awardResult.errors.length > 0
        ) {
          xpAwarded = awardResult;
        }

        if (!awardResult.success && awardResult.errors.length > 0) {
          console.error("Failed to auto-award points for updated grade", {
            gradeId,
            errors: awardResult.errors,
          });
        }
      } catch (error) {
        console.error("Failed to refresh points for updated grade", error);
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedGrade,
      ...(xpAwarded ? { xpAwarded } : {}),
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

    const gradeId = String(params.id ?? "").trim();
    if (!gradeId) {
      return NextResponse.json(
        { success: false, error: "Grade id is required" },
        { status: 400 }
      );
    }

    if (!mongooseConnection) {
      const removed = deleteGradeInMemory(gradeId);
      if (!removed) {
        return NextResponse.json(
          { success: false, error: "Grade not found" },
          { status: 404 }
        );
      }
    } else {
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

      try {
        const revokeResult = await revokePointsForGrade(gradeId, "Grade deleted");
        if (!revokeResult.success) {
          console.error("Failed to revoke points for deleted grade", {
            gradeId,
          });
        }
      } catch (error) {
        console.error("Failed to revoke points for deleted grade", error);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: "Grade deleted successfully",
      },
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

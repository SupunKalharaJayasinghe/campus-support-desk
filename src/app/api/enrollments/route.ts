import mongoose from "mongoose";
import { NextResponse } from "next/server";
import "@/models/Enrollment";
import "@/models/ModuleOffering";
import "@/models/Student";
import { connectMongoose } from "@/lib/mongoose";
import { findModuleOfferingById } from "@/lib/module-offering-store";
import {
  findStudentInMemoryById,
  listEnrollmentRecordsInMemory,
} from "@/lib/student-registration";
import { EnrollmentModel } from "@/models/Enrollment";
import { ModuleOfferingModel } from "@/models/ModuleOffering";
import { StudentModel } from "@/models/Student";

type EnrollmentStatus = "ACTIVE" | "INACTIVE";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeAcademicCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function sanitizeStatus(value: string | null): "" | EnrollmentStatus {
  if (value === "ACTIVE" || value === "INACTIVE") {
    return value;
  }

  return "";
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

export async function GET(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);

    const { searchParams } = new URL(request.url);
    const moduleOfferingId = String(searchParams.get("moduleOfferingId") ?? "").trim();
    const studentId = String(searchParams.get("studentId") ?? "").trim();
    const intakeId = String(searchParams.get("intakeId") ?? "").trim();
    const degreeProgramId = normalizeAcademicCode(searchParams.get("degreeProgramId"));
    const statusParam = searchParams.get("status");
    const status = sanitizeStatus(statusParam);

    if (
      mongooseConnection &&
      moduleOfferingId &&
      !mongoose.Types.ObjectId.isValid(moduleOfferingId)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid module offering id" },
        { status: 400 }
      );
    }

    if (mongooseConnection && studentId && !mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid student id" },
        { status: 400 }
      );
    }

    if (statusParam !== null && !status) {
      return NextResponse.json(
        { success: false, error: "Status must be ACTIVE or INACTIVE" },
        { status: 400 }
      );
    }

    const query: Record<string, unknown> = {};

    if (studentId) {
      query.studentId = studentId;
    }

    if (moduleOfferingId) {
      const offering = mongooseConnection
        ? await ModuleOfferingModel.findById(moduleOfferingId)
            .select("intakeId degreeProgramId")
            .lean()
            .exec()
            .catch(() => null)
        : findModuleOfferingById(moduleOfferingId);

      if (!offering) {
        return NextResponse.json(
          { success: false, error: "Module offering not found" },
          { status: 404 }
        );
      }

      const offeringRow = asObject(offering);
      query.intakeId = collapseSpaces(offeringRow?.intakeId);
      query.degreeProgramId = collapseSpaces(offeringRow?.degreeProgramId).toUpperCase();
      query.status = status || "ACTIVE";
    } else {
      if (intakeId) {
        query.intakeId = intakeId;
      }
      if (degreeProgramId) {
        query.degreeProgramId = degreeProgramId;
      }
      if (status) {
        query.status = status;
      }
    }

    const rows = mongooseConnection
      ? ((await EnrollmentModel.find(query)
          .sort({ updatedAt: -1 })
          .lean()
          .exec()
          .catch(() => [])) as unknown[])
      : listEnrollmentRecordsInMemory({
          studentId,
          intakeId: collapseSpaces(query.intakeId),
          degreeProgramId: collapseSpaces(query.degreeProgramId),
          status: (collapseSpaces(query.status) as EnrollmentStatus) || "",
        });

    const studentsById = new Map<
      string,
      {
        id: string;
        studentId: string;
        firstName: string;
        lastName: string;
        fullName: string;
        email: string;
        status: string;
      }
    >();

    if (mongooseConnection) {
      const studentObjectIds = rows
        .map((row) => {
          const record = asObject(row);
          const id = readId(record?.studentId);
          return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
        })
        .filter((row): row is mongoose.Types.ObjectId => Boolean(row));

      const studentRows =
        studentObjectIds.length > 0
          ? ((await StudentModel.find({ _id: { $in: studentObjectIds } })
              .select("studentId firstName lastName email status")
              .lean()
              .exec()
              .catch(() => [])) as unknown[])
          : [];

      studentRows.forEach((row) => {
        const record = asObject(row);
        const id = readId(record?._id);
        const registrationNumber = collapseSpaces(record?.studentId).toUpperCase();
        const firstName = collapseSpaces(record?.firstName);
        const lastName = collapseSpaces(record?.lastName);

        if (!id || !registrationNumber) {
          return;
        }

        studentsById.set(id, {
          id,
          studentId: registrationNumber,
          firstName,
          lastName,
          fullName: [firstName, lastName].filter(Boolean).join(" ").trim(),
          email: collapseSpaces(record?.email).toLowerCase(),
          status: collapseSpaces(record?.status).toUpperCase(),
        });
      });
    } else {
      rows.forEach((row) => {
        const record = asObject(row);
        const id = readId(record?.studentId);
        const student = findStudentInMemoryById(id);
        if (!student) {
          return;
        }

        studentsById.set(student.id, {
          id: student.id,
          studentId: student.studentId,
          firstName: student.firstName,
          lastName: student.lastName,
          fullName: [student.firstName, student.lastName].filter(Boolean).join(" ").trim(),
          email: student.email,
          status: student.status,
        });
      });
    }

    const items = rows
      .map((row) => {
        const record = asObject(row);
        if (!record) {
          return null;
        }

        const id = readId(record._id);
        const studentRecordId = readId(record.studentId);
        const student = studentsById.get(studentRecordId);

        if (!id || !studentRecordId || !student) {
          return null;
        }

        return {
          id,
          studentId: studentRecordId,
          facultyId: normalizeAcademicCode(record.facultyId),
          degreeProgramId: normalizeAcademicCode(record.degreeProgramId),
          intakeId: collapseSpaces(record.intakeId),
          stream: collapseSpaces(record.stream).toUpperCase(),
          subgroup: collapseSpaces(record.subgroup),
          status: collapseSpaces(record.status).toUpperCase(),
          createdAt: toIsoDate(record.createdAt),
          updatedAt: toIsoDate(record.updatedAt),
          student: {
            _id: student.id,
            id: student.id,
            studentId: student.studentId,
            registrationNumber: student.studentId,
            firstName: student.firstName,
            lastName: student.lastName,
            fullName: student.fullName,
            email: student.email,
            status: student.status,
          },
        };
      })
      .filter(
        (
          row
        ): row is {
          id: string;
          studentId: string;
          facultyId: string;
          degreeProgramId: string;
          intakeId: string;
          stream: string;
          subgroup: string;
          status: string;
          createdAt: string;
          updatedAt: string;
          student: {
            _id: string;
            id: string;
            studentId: string;
            registrationNumber: string;
            firstName: string;
            lastName: string;
            fullName: string;
            email: string;
            status: string;
          };
        } => Boolean(row)
      )
      .sort((left, right) => left.student.studentId.localeCompare(right.student.studentId));

    return NextResponse.json({
      success: true,
      data: { items },
      items,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load enrollments",
      },
      { status: 500 }
    );
  }
}

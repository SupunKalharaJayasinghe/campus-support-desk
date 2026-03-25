import { NextResponse } from "next/server";
import "@/models/LabAssistant";
import "@/models/User";
import { connectMongoose } from "@/models/mongoose";
import {
  buildLabAssistantEmailLocalPart,
  createLabAssistantInMemory,
  getLabAssistantEmailDomain,
  listLabAssistantsInMemory,
  sanitizeAcademicCodeList,
  sanitizeLabAssistantName,
  sanitizeLabAssistantNicStaffId,
  sanitizeLabAssistantPhone,
  sanitizeLabAssistantStatus,
  sanitizeModuleIdList,
  toLabAssistantPersistedRecordFromUnknown,
  validateLabAssistantEligibility,
  type LabAssistantPersistedRecord,
  type LabAssistantSort,
  type LabAssistantStatus,
} from "@/models/lab-assistant-store";
import { getMongoDuplicateField, isMongoDuplicateKeyError } from "@/models/student-registration";
import { hashStaffPassword, resolveDefaultStaffPassword } from "@/models/staff-auth";
import { LabAssistantModel } from "@/models/LabAssistant";
import { UserModel } from "@/models/User";

interface LabAssistantWriteInput {
  fullName: string;
  phone: string;
  nicStaffId: string | null;
  status: LabAssistantStatus;
  facultyIds: string[];
  degreeProgramIds: string[];
  moduleIds: string[];
}

function parsePageParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parsePageSizeParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const nextValue = Math.floor(parsed);
  if (![10, 25, 50, 100].includes(nextValue)) {
    return fallback;
  }

  return nextValue;
}

function sanitizeSort(value: string | null): LabAssistantSort {
  if (value === "az" || value === "za" || value === "created") {
    return value;
  }

  return "updated";
}

function sanitizeStatus(value: string | null): "" | LabAssistantStatus {
  if (value === "ACTIVE" || value === "INACTIVE") {
    return value;
  }

  return "";
}

function toWriteInput(body: Partial<Record<string, unknown>>): LabAssistantWriteInput | null {
  const fullName = sanitizeLabAssistantName(body.fullName);
  if (!fullName) {
    return null;
  }

  return {
    fullName,
    phone: sanitizeLabAssistantPhone(body.phone),
    nicStaffId: sanitizeLabAssistantNicStaffId(body.nicStaffId),
    status: sanitizeLabAssistantStatus(body.status),
    facultyIds: sanitizeAcademicCodeList(body.facultyIds),
    degreeProgramIds: sanitizeAcademicCodeList(body.degreeProgramIds),
    moduleIds: sanitizeModuleIdList(body.moduleIds),
  };
}

function toApiLabAssistant(row: LabAssistantPersistedRecord) {
  return {
    ...row,
    eligibilityCounts: {
      faculties: row.facultyIds.length,
      degrees: row.degreeProgramIds.length,
      modules: row.moduleIds.length,
    },
  };
}

async function reserveUniqueLabAssistantEmailInDb(
  fullName: string,
  options?: { excludeId?: string }
) {
  const baseLocalPart = buildLabAssistantEmailLocalPart(fullName);
  const domain = getLabAssistantEmailDomain();
  const excludeId = String(options?.excludeId ?? "").trim();

  for (let index = 1; index <= 999; index += 1) {
    const candidateEmail =
      index === 1
        ? `${baseLocalPart}@${domain}`
        : `${baseLocalPart}${index}@${domain}`;
    const query = excludeId
      ? { email: candidateEmail, _id: { $ne: excludeId } }
      : { email: candidateEmail };
    const exists = await LabAssistantModel.exists(query).catch(() => null);
    if (!exists) {
      return candidateEmail;
    }
  }

  throw new Error("Failed to allocate lab assistant email");
}

export async function GET(request: Request) {
  const mongooseConnection = await connectMongoose().catch(() => null);
  const { searchParams } = new URL(request.url);
  const search = String(searchParams.get("search") ?? "").trim();
  const status = sanitizeStatus(searchParams.get("status"));
  const sort = sanitizeSort(searchParams.get("sort"));
  const pageSize = parsePageSizeParam(searchParams.get("pageSize"), 10);
  const page = parsePageParam(searchParams.get("page"), 1);

  if (!mongooseConnection) {
    const allItems = listLabAssistantsInMemory({ search, status, sort });
    const total = allItems.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, pageCount);
    const start = (safePage - 1) * pageSize;

    return NextResponse.json({
      items: allItems.slice(start, start + pageSize).map((item) => toApiLabAssistant(item)),
      total,
      page: safePage,
      pageSize,
    });
  }

  const query: Record<string, unknown> = {};
  if (status) {
    query.status = status;
  }

  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escapedSearch, "i");
    query.$or = [
      { fullName: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
      { nicStaffId: searchRegex },
    ];
  }

  const total = await LabAssistantModel.countDocuments(query).catch(() => 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const skip = (safePage - 1) * pageSize;
  const sortQuery: Record<string, 1 | -1> =
    sort === "az"
      ? { fullName: 1 }
      : sort === "za"
        ? { fullName: -1 }
        : sort === "created"
          ? { createdAt: -1 }
          : { updatedAt: -1 };

  const rows = (await LabAssistantModel.find(query)
    .sort(sortQuery)
    .skip(skip)
    .limit(pageSize)
    .lean()
    .exec()
    .catch(() => [])) as unknown[];

  const items = rows
    .map((row) => toLabAssistantPersistedRecordFromUnknown(row))
    .filter((row): row is LabAssistantPersistedRecord => Boolean(row))
    .map((row) => toApiLabAssistant(row));

  return NextResponse.json({
    items,
    total,
    page: safePage,
    pageSize,
  });
}

export async function POST(request: Request) {
  try {
    const mongooseConnection = await connectMongoose().catch(() => null);
    const rawBody = (await request.json().catch(() => null)) as
      | Partial<Record<string, unknown>>
      | null;
    const body = rawBody ?? {};
    const input = toWriteInput(body);

    if (!input) {
      return NextResponse.json(
        { message: "Full name is required" },
        { status: 400 }
      );
    }

    let validated: {
      facultyIds: string[];
      degreeProgramIds: string[];
      moduleIds: string[];
    };
    try {
      validated = validateLabAssistantEligibility({
        facultyIds: input.facultyIds,
        degreeProgramIds: input.degreeProgramIds,
        moduleIds: input.moduleIds,
      });
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Invalid support scope" },
        { status: 400 }
      );
    }

    if (!mongooseConnection) {
      try {
        const created = createLabAssistantInMemory({
          ...input,
          ...validated,
        });
        return NextResponse.json(toApiLabAssistant(created), { status: 201 });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create lab assistant";
        if (message === "NIC/Staff ID already exists") {
          return NextResponse.json({ message }, { status: 409 });
        }

        throw error;
      }
    }

    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const generatedEmail = await reserveUniqueLabAssistantEmailInDb(input.fullName);

      try {
        const created = await LabAssistantModel.create({
          fullName: input.fullName,
          email: generatedEmail,
          phone: input.phone,
          nicStaffId: input.nicStaffId,
          status: input.status,
          facultyIds: validated.facultyIds,
          degreeProgramIds: validated.degreeProgramIds,
          moduleIds: validated.moduleIds,
        });

        try {
          const defaultPassword = resolveDefaultStaffPassword({
            role: "LAB_ASSISTANT",
            nicStaffId: input.nicStaffId,
          });
          const passwordHash = await hashStaffPassword(defaultPassword);

          await UserModel.create({
            username: generatedEmail,
            email: generatedEmail,
            role: "LAB_ASSISTANT",
            passwordHash,
            mustChangePassword: true,
            status: input.status,
            labAssistantRef: created._id,
          });
        } catch (userCreateError) {
          await LabAssistantModel.deleteOne({ _id: created._id }).catch(() => null);
          const duplicateField = getMongoDuplicateField(userCreateError);
          if (duplicateField === "email" || duplicateField === "username") {
            if (attempt < maxAttempts - 1) {
              continue;
            }

            return NextResponse.json(
              { message: "Generated lab assistant login already exists. Please retry." },
              { status: 409 }
            );
          }

          throw userCreateError;
        }

        const parsed = toLabAssistantPersistedRecordFromUnknown(created.toObject());
        if (!parsed) {
          throw new Error("Failed to map lab assistant");
        }

        return NextResponse.json(toApiLabAssistant(parsed), { status: 201 });
      } catch (error) {
        const duplicateField = getMongoDuplicateField(error);
        if (duplicateField === "nicStaffId") {
          return NextResponse.json(
            { message: "NIC/Staff ID already exists" },
            { status: 409 }
          );
        }

        if (isMongoDuplicateKeyError(error) && duplicateField === "email") {
          continue;
        }

        if (isMongoDuplicateKeyError(error) && attempt < maxAttempts - 1) {
          continue;
        }

        throw error;
      }
    }

    return NextResponse.json(
      { message: "Failed to allocate lab assistant email. Please retry." },
      { status: 409 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to create lab assistant",
      },
      { status: 500 }
    );
  }
}


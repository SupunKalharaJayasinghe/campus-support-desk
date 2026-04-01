import { NextRequest, NextResponse } from "next/server";
import { CommunityProfileModel } from "@/models/CommunityProfile";
import { connectDB } from "@/lib/mongodb";

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toVisibilityStatus(visibility: unknown) {
  return visibility === "private" ? "PRIVATE" : "PUBLIC";
}

// CREATE PROFILE
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const { userId, displayName } = await req.json();
    if (!userId || !displayName) {
      return NextResponse.json(
        { message: "userId and displayName are required" },
        { status: 400 }
      );
    }

    // check already exists
    const existing = await CommunityProfileModel.findOne({ userRef: userId });
    if (existing) {
      return NextResponse.json(
        { message: "Profile already exists" },
        { status: 400 }
      );
    }

    const profile = await CommunityProfileModel.create({
      userRef: userId,
      displayName: toTrimmedString(displayName) || "Current User",
    });

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to create profile",
      },
      { status: 500 }
    );
  }
}

// GET PROFILE
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ message: "userId is required" }, { status: 400 });
    }

    const profile = await CommunityProfileModel.findOne({
      userRef: userId,
    });

    if (!profile) {
      return NextResponse.json(
        { message: "Profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load profile" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    await connectDB();

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const userId = toTrimmedString(body.userId);
    if (!userId) {
      return NextResponse.json({ message: "userId is required" }, { status: 400 });
    }

    const displayName = toTrimmedString(body.displayName) || "Current User";
    const username = toTrimmedString(body.username);
    const email = toTrimmedString(body.email);
    const bio = toTrimmedString(body.bio);
    const faculty = toTrimmedString(body.faculty) || "Computing";
    const studyYear = toTrimmedString(body.studyYear) || "Year 2";
    const avatarUrl = toTrimmedString(body.avatarUrl ?? body.avatar);
    const status = toVisibilityStatus(body.visibility);

    const updated = await CommunityProfileModel.findOneAndUpdate(
      { userRef: userId },
      {
        displayName,
        username,
        email,
        bio,
        faculty,
        studyYear,
        avatarUrl,
        status,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to update profile",
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { CommunityProfileModel } from "@/models/CommunityProfile";
import { connectDB } from "@/lib/mongodb";

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
      displayName,
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

    const { userId, displayName, bio, avatar } = await req.json();

    const updated = await CommunityProfileModel.findOneAndUpdate(
      { userRef: userId },
      { displayName, bio, avatar },
      { new: true }
    );

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}

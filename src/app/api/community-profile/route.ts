import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { CommunityProfileModel } from "@/models/CommunityProfile";
import { connectDB } from "@/lib/mongodb";
import { isCommunityAdminRole, resolveActiveApiUser } from "@/lib/resolve-api-user";
import CommunityPost from "@/models/communityPost";
import CommunityReply from "@/models/communityReply";

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toVisibilityStatus(visibility: unknown) {
  const normalized = String(visibility ?? "")
    .trim()
    .toLowerCase();
  return normalized === "private" ? "PRIVATE" : "PUBLIC";
}

// CREATE PROFILE
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const actor = await resolveActiveApiUser(req);
    if (!actor) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!isCommunityAdminRole(actor.role)) {
      return NextResponse.json(
        { message: "Only a community admin can create community profiles." },
        { status: 403 }
      );
    }

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
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ message: "Invalid userId" }, { status: 400 });
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

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const [postsCount, repliesCount, openPostsCount] = await Promise.all([
      CommunityPost.countDocuments({ author: userObjectId }),
      CommunityReply.countDocuments({ author: userObjectId }),
      CommunityPost.countDocuments({ author: userObjectId, status: "open" }),
    ]);

    const storedPosts = Number(profile.postsCount) || 0;
    const storedReplies = Number(profile.repliesCount) || 0;
    if (storedPosts !== postsCount || storedReplies !== repliesCount) {
      await CommunityProfileModel.updateOne(
        { _id: profile._id },
        { $set: { postsCount, repliesCount } }
      );
    }

    const plain = profile.toObject();
    return NextResponse.json({
      ...plain,
      postsCount,
      repliesCount,
      /** Open posts only — used for profile “current posts” stat. */
      openPostsCount,
    });
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

    const actor = await resolveActiveApiUser(req);
    if (!actor) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const userId = toTrimmedString(body.userId);
    if (!userId) {
      return NextResponse.json({ message: "userId is required" }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ message: "Invalid userId" }, { status: 400 });
    }

    const existingProfile = await CommunityProfileModel.findOne({ userRef: userId })
      .select({ _id: 1 })
      .lean();
    const admin = isCommunityAdminRole(actor.role);
    const isSelf = actor.id === userId;

    if (!existingProfile && !admin) {
      return NextResponse.json(
        {
          message:
            "You are not in the community yet. A community admin must add you before you can edit your profile.",
        },
        { status: 403 }
      );
    }

    if (existingProfile && !admin && !isSelf) {
      return NextResponse.json(
        { message: "You can only update your own community profile." },
        { status: 403 }
      );
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
      { new: true, upsert: admin, setDefaultsOnInsert: admin }
    );

    if (!updated && !admin) {
      return NextResponse.json(
        { message: "Community profile not found." },
        { status: 404 }
      );
    }

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

/** Community admin: remove a user's community profile (user account remains). */
export async function DELETE(req: NextRequest) {
  try {
    await connectDB();

    const actor = await resolveActiveApiUser(req);
    if (!actor) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!isCommunityAdminRole(actor.role)) {
      return NextResponse.json(
        { message: "Only a community admin can remove community members." },
        { status: 403 }
      );
    }

    const userId = toTrimmedString(req.nextUrl.searchParams.get("userId"));
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ message: "Valid userId is required" }, { status: 400 });
    }

    const result = await CommunityProfileModel.deleteOne({ userRef: userId });
    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Community profile not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Member removed from community." });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to remove community profile",
      },
      { status: 500 }
    );
  }
}

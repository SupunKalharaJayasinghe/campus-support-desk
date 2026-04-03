import { NextRequest, NextResponse } from "next/server";
import { CommunityProfileModel } from "@/models/CommunityProfile";
import { connectDB } from "@/lib/mongodb";
import {
  applyCommunityProfileInc,
  COMMUNITY_POINTS_ACCEPTED_ANSWER,
  COMMUNITY_POINTS_PER_POST,
  COMMUNITY_POINTS_PER_REPLY,
} from "@/lib/community-profile-points";

const UPVOTE_POINTS = 2;

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const { userId, action } = await req.json();

    let pointsToAdd = 0;

    if (action === "POST") pointsToAdd = COMMUNITY_POINTS_PER_POST;
    if (action === "REPLY") pointsToAdd = COMMUNITY_POINTS_PER_REPLY;
    if (action === "ACCEPTED") pointsToAdd = COMMUNITY_POINTS_ACCEPTED_ANSWER;
    if (action === "UPVOTE") pointsToAdd = UPVOTE_POINTS;

    if (!pointsToAdd || typeof userId !== "string" || !userId.trim()) {
      return NextResponse.json(
        { error: "userId and a valid action are required" },
        { status: 400 }
      );
    }

    await applyCommunityProfileInc(userId.trim(), { points: pointsToAdd });

    const profile = await CommunityProfileModel.findOne({ userRef: userId.trim() }).lean();
    if (!profile) {
      return NextResponse.json({ error: "Community profile not found" }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
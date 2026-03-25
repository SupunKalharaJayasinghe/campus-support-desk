import { NextRequest, NextResponse } from "next/server";
import { CommunityProfileModel } from "@/models/CommunityProfile";
import { connectDB } from "@/lib/mongodb";

function getLevel(points: number) {
  if (points >= 500) return "EXPERT";
  if (points >= 100) return "HELPER";
  return "BEGINNER";
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const { userId, action } = await req.json();

    let pointsToAdd = 0;

    if (action === "POST") pointsToAdd = 10;
    if (action === "REPLY") pointsToAdd = 5;
    if (action === "ACCEPTED") pointsToAdd = 15;
    if (action === "UPVOTE") pointsToAdd = 2;

    const profile = await CommunityProfileModel.findOneAndUpdate(
      { userRef: userId },
      { $inc: { points: pointsToAdd } },
      { new: true }
    );

    // update level
    profile.level = getLevel(profile.points);
    await profile.save();

    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
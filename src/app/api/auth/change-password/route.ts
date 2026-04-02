import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import "@/models/User";
import { connectMongoose } from "@/models/mongoose";
import { UserModel } from "@/models/User";

export async function POST(request: Request) {
  try {
    const userId = String(request.headers.get("x-user-id") ?? "").trim();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const rawBody = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    const body = rawBody ?? {};
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { message: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { message: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const mongooseConnection = await connectMongoose().catch(() => null);
        if (!mongooseConnection) {
      return NextResponse.json(
        { message: "Database connection is required" },
        { status: 503 }
      );
    }

    const user = await UserModel.findOne({ _id: userId, status: "ACTIVE" }).exec();
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const passwordMatched = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordMatched) {
      return NextResponse.json(
        { message: "Current password is incorrect" },
        { status: 400 }
      );
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    await user.save();

    return NextResponse.json({
      ok: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to change password",
      },
      { status: 500 }
    );
  }
}


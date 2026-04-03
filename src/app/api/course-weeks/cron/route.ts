import { NextResponse } from "next/server";
import { connectMongoose } from "@/models/mongoose";
import { runCourseWeekNotificationJob } from "@/models/course-week-notifications";

function collapseSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isAuthorizedCronRequest(request: Request) {
  const configuredSecret = collapseSpaces(process.env.COURSE_WEEK_CRON_SECRET);
  if (!configuredSecret) {
    return true;
  }

  const providedSecret = collapseSpaces(
    request.headers.get("x-cron-secret") ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  );
  return providedSecret === configuredSecret;
}

export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return NextResponse.json(
      { message: "Database connection is required" },
      { status: 503 }
    );
  }

  const summary = await runCourseWeekNotificationJob();
  return NextResponse.json({
    ok: true,
    summary,
  });
}

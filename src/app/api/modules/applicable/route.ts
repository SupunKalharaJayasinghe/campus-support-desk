import { NextResponse } from "next/server";
import "@/models/Module";
import { connectMongoose } from "@/lib/mongoose";
import { listApplicableModules } from "@/lib/module-store";

export async function GET(request: Request) {
  await connectMongoose().catch(() => null);
  const { searchParams } = new URL(request.url);

  const facultyCode = String(searchParams.get("facultyCode") ?? "")
    .trim()
    .toUpperCase();
  const degreeId = String(searchParams.get("degreeId") ?? "")
    .trim()
    .toUpperCase();
  const termCode = String(searchParams.get("term") ?? "")
    .trim()
    .toUpperCase();

  if (!facultyCode) {
    return NextResponse.json(
      { message: "facultyCode is required" },
      { status: 400 }
    );
  }

  if (!degreeId) {
    return NextResponse.json(
      { message: "degreeId is required" },
      { status: 400 }
    );
  }

  if (!termCode) {
    return NextResponse.json(
      { message: "term is required" },
      { status: 400 }
    );
  }

  const items = listApplicableModules({
    facultyCode,
    degreeId,
    termCode,
  });

  return NextResponse.json({ items });
}

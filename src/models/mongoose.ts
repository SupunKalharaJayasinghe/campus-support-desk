import { connectDB } from "@/models/db";
import { syncAcademicReferenceCaches } from "@/models/academic-reference-cache";

export async function connectMongoose() {
  try {
    const connection = await connectDB();
    await syncAcademicReferenceCaches().catch(() => null);
    return connection;
  } catch {
    return null;
  }
}


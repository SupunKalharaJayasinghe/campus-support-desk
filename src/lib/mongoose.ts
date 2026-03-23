import { connectDB } from "@/lib/db";

export async function connectMongoose() {
  try {
    return await connectDB();
  } catch {
    return null;
  }
}

import { connectDB } from "@/models/db";

export async function connectMongoose() {
  try {
    return await connectDB();
  } catch {
    return null;
  }
}


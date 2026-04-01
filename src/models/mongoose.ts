import { connectDB } from "@/models/db";

export async function connectMongoose() {
  try {
    return await connectDB();
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    return null;
  }
}


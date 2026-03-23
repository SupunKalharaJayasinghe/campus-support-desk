import { connectDB } from "@/lib/mongodb";

export async function connectMongoose() {
  return connectDB();
}

import mongoose from "mongoose";

type MongooseGlobalCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongoose: MongooseGlobalCache | undefined;
}

const cached = global.mongoose ?? { conn: null, promise: null };
if (!global.mongoose) {
  global.mongoose = cached;
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is missing in environment variables.");
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const dbName = process.env.MONGODB_DB?.trim() || "UniHub";
    cached.promise = mongoose
      .connect(uri, {
        dbName,
        serverSelectionTimeoutMS: 10_000,
        /** Drop stale sockets; helps reduce ECONNRESET after idle (local + Atlas). */
        maxIdleTimeMS: 60_000,
        heartbeatFrequencyMS: 10_000,
        retryWrites: true,
      })
      .then((instance) => {
        console.log(`MongoDB Connected to database: ${dbName}`);
        return instance;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    console.error("MongoDB connection failed:", error);
    throw error;
  }
}

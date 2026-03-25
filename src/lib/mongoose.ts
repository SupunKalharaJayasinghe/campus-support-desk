import mongoose from "mongoose";

declare global {
  var __mongooseConnectionPromise: Promise<typeof mongoose> | undefined;
}

export async function connectMongoose() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return null;
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!global.__mongooseConnectionPromise) {
    global.__mongooseConnectionPromise = mongoose
      .connect(uri, {
        dbName: process.env.MONGODB_DB || undefined,
      })
      .catch((error) => {
        global.__mongooseConnectionPromise = undefined;
        throw error;
      });
  }

  return global.__mongooseConnectionPromise;
}

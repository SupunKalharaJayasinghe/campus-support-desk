import { connectDB } from "@/models/db";
import { syncAcademicReferenceCaches } from "@/models/academic-reference-cache";

export async function connectMongoose(options?: {
  syncAcademicCache?: boolean;
  forceAcademicCacheSync?: boolean;
  minAcademicCacheSyncIntervalMs?: number;
}) {
  try {
    const connection = await connectDB();
    if (options?.syncAcademicCache !== false) {
      await syncAcademicReferenceCaches({
        force: options?.forceAcademicCacheSync === true,
        minIntervalMs: options?.minAcademicCacheSyncIntervalMs,
      }).catch(() => null);
    }
    return connection;
  } catch {
    return null;
  }
}


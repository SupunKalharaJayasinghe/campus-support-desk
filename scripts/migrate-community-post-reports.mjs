/**
 * Aligns the communitypostreports collection with src/models/communityPostReport.ts:
 * - Backfills missing fields (defaults are not applied to existing docs by Mongoose)
 * - syncIndexes() for single-field indexes + compound unique (postId, userId) + { status, createdAt }
 *
 * Fails before index sync if duplicate (postId, userId) pairs exist (unique index would fail).
 *
 * Usage (from repo root):
 *   node scripts/migrate-community-post-reports.mjs
 */
import { existsSync, readFileSync } from "fs";
import mongoose, { Schema } from "mongoose";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadDotEnvLocal() {
  const path = resolve(root, ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadDotEnvLocal();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set (add to .env.local or export it).");
  process.exit(1);
}

/** Keep in sync with src/models/communityPostReport.ts */
const CommunityPostReportSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityPost",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    reasonKey: {
      type: String,
      enum: ["spam", "harassment", "misinformation", "inappropriate", "copyright", "other"],
      required: false,
      index: true,
    },
    details: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["OPEN", "REVIEWED", "AGREED", "DISMISSED"],
      default: "OPEN",
      index: true,
    },
    adminReviewAcknowledged: {
      type: Boolean,
      default: false,
    },
    reviewComment: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },
  },
  { timestamps: true }
);

CommunityPostReportSchema.index({ postId: 1, userId: 1 }, { unique: true });
CommunityPostReportSchema.index({ status: 1, createdAt: -1 });

const CommunityPostReport =
  mongoose.models.CommunityPostReport ||
  mongoose.model("CommunityPostReport", CommunityPostReportSchema);

async function main() {
  await mongoose.connect(uri);
  const collName = CommunityPostReport.collection.name;
  console.log(`Using collection: ${collName}`);

  const dupes = await CommunityPostReport.aggregate([
    {
      $group: {
        _id: { postId: "$postId", userId: "$userId" },
        count: { $sum: 1 },
        ids: { $push: "$_id" },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (dupes.length > 0) {
    console.error(
      "Duplicate reports for the same postId+userId (fix or delete before creating unique index):"
    );
    for (const d of dupes) {
      console.error(JSON.stringify(d, null, 2));
    }
    await mongoose.disconnect();
    process.exit(1);
  }

  const r1 = await CommunityPostReport.updateMany(
    { adminReviewAcknowledged: { $exists: false } },
    { $set: { adminReviewAcknowledged: false } }
  );
  const r2 = await CommunityPostReport.updateMany(
    { reviewComment: { $exists: false } },
    { $set: { reviewComment: "" } }
  );
  const r3 = await CommunityPostReport.updateMany(
    { status: { $exists: false } },
    { $set: { status: "OPEN" } }
  );

  let statusCasingNormalized = 0;
  for (const s of ["open", "reviewed", "agreed", "dismissed"]) {
    const up = await CommunityPostReport.updateMany({ status: s }, { $set: { status: s.toUpperCase() } });
    statusCasingNormalized += up.modifiedCount;
  }

  const stillBad = await CommunityPostReport.countDocuments({
    status: { $nin: ["OPEN", "REVIEWED", "AGREED", "DISMISSED"] },
  });
  if (stillBad > 0) {
    console.warn(
      `${stillBad} document(s) still have a non-enum status; set manually or they may fail validation on save.`
    );
  }

  const dropped = await CommunityPostReport.syncIndexes();
  if (dropped && dropped.length) {
    console.log("Dropped indexes not in schema:", dropped);
  }

  console.log("Backfill:", {
    adminReviewAcknowledgedSet: r1.modifiedCount,
    reviewCommentSet: r2.modifiedCount,
    statusMissingSet: r3.modifiedCount,
    statusCasingNormalized,
  });
  console.log("syncIndexes() completed for CommunityPostReport.");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

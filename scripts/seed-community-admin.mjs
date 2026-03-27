/**
 * Upserts a COMMUNITY_ADMIN user (username cad / password from env or default).
 * Loads MONGODB_URI from process.env or `.env.local` in the project root.
 *
 * Usage (from repo root):
 *   node scripts/seed-community-admin.mjs
 */
import bcrypt from "bcryptjs";
import { existsSync, readFileSync } from "fs";
import mongoose from "mongoose";
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

const USERNAME = (process.env.SEED_COMMUNITY_ADMIN_USER ?? "cad").trim();
const PASSWORD = process.env.SEED_COMMUNITY_ADMIN_PASSWORD ?? "12345678";
const EMAIL = (
  process.env.SEED_COMMUNITY_ADMIN_EMAIL ?? `${USERNAME}@community.local`
)
  .trim()
  .toLowerCase();

async function main() {
  await mongoose.connect(uri);
  const col = mongoose.connection.collection("users");
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const result = await col.updateOne(
    { $or: [{ username: USERNAME }, { email: EMAIL }] },
    {
      $set: {
        username: USERNAME,
        email: EMAIL,
        role: "COMMUNITY_ADMIN",
        passwordHash,
        mustChangePassword: false,
        status: "ACTIVE",
      },
    },
    { upsert: true }
  );

  if (result.matchedCount === 0 && result.upsertedCount === 0 && result.modifiedCount === 0) {
    console.warn("No changes reported; check filter and collection name.");
  } else {
    console.log(
      `COMMUNITY_ADMIN user ready: username=${USERNAME} email=${EMAIL} (upserted=${result.upsertedCount}, modified=${result.modifiedCount})`
    );
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

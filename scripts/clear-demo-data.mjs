import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      return;
    }

    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  });
}

const repoRoot = process.cwd();
loadEnvFile(path.join(repoRoot, ".env"));
loadEnvFile(path.join(repoRoot, ".env.local"));

const uri = String(process.env.MONGODB_URI ?? "").trim();
if (!uri) {
  console.error("MONGODB_URI is required to clear demo data.");
  process.exit(1);
}

const dbName = String(process.env.MONGODB_DB ?? "UniHub").trim() || "UniHub";

const collectionsToClear = [
  "users",
  "students",
  "enrollments",
  "counters",
  "lecturers",
  "labassistants",
  "moduleofferings",
  "modules",
  "faculties",
  "degreeprograms",
  "intakerecords",
  "intakes",
];

async function main() {
  await mongoose.connect(uri, {
    dbName,
    serverSelectionTimeoutMS: 10000,
  });

  const database = mongoose.connection.db;
  if (!database) {
    throw new Error("MongoDB database handle is unavailable");
  }

  for (const collectionName of collectionsToClear) {
    const exists = await database
      .listCollections({ name: collectionName }, { nameOnly: true })
      .hasNext()
      .catch(() => false);

    if (!exists) {
      continue;
    }

    const result = await database.collection(collectionName).deleteMany({});
    console.log(`${collectionName}: deleted ${result.deletedCount}`);
  }

  await mongoose.disconnect();
  console.log("Demo data cleared.");
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});

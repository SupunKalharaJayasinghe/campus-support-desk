import fs from "node:fs";
import path from "node:path";

const nextDir = path.join(process.cwd(), ".next");

function rmSafe(targetPath) {
  try {
    fs.rmSync(targetPath, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 150,
    });
    return true;
  } catch (err) {
    return false;
  }
}

function main() {
  if (!fs.existsSync(nextDir)) return;

  let entries = [];
  try {
    entries = fs.readdirSync(nextDir, { withFileTypes: true });
  } catch {
    // If we can't even list it, best effort: try remove dir.
    rmSafe(nextDir);
    return;
  }

  // Best-effort cleanup: delete children first.
  for (const entry of entries) {
    const p = path.join(nextDir, entry.name);
    const ok = rmSafe(p);
    if (!ok && entry.name === "trace") {
      // Windows sometimes locks `.next/trace`. If we can't delete it, try truncating.
      try {
        fs.writeFileSync(p, "");
      } catch {
        // ignore
      }
    }
  }

  // Then try remove the directory itself (may fail if something is still locked).
  rmSafe(nextDir);
}

main();


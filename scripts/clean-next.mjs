/**
 * Remove `.next` with retries. Windows often returns EPERM/EBUSY when another
 * Node process, Defender, or an indexer holds files under `.next` (e.g. `trace`).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, ".next");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!fs.existsSync(dir)) {
    console.log("[clean-next] No .next folder to remove.");
    return;
  }

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log("[clean-next] Removed .next");
      return;
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? e.code : "";
      if ((code === "EPERM" || code === "EBUSY") && attempt < 5) {
        console.warn(`[clean-next] Attempt ${attempt} failed (${String(code)}), retrying…`);
        await sleep(attempt * 400);
        continue;
      }
      console.error(
        "[clean-next] Could not delete .next. Stop all Next/Node processes (other terminals, IDE preview), then retry. If it keeps happening, add this project folder to Windows Security exclusions."
      );
      throw e;
    }
  }
}

main().catch(() => process.exit(1));

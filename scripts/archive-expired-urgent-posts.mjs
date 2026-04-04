#!/usr/bin/env node

/**
 * Script to archive expired urgent community posts.
 * 
 * Usage:
 *   node scripts/archive-expired-urgent-posts.mjs [--check] [--verbose]
 * 
 * Options:
 *   --check      Only count expired posts without archiving
 *   --verbose    Print detailed output including expired post details
 * 
 * Example cron job (daily at 2 AM):
 *   0 2 * * * cd /path/to/project && node scripts/archive-expired-urgent-posts.mjs
 */

import path from "path";
import { fileURLToPath } from "url";

// Handle module path for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Add src to path for module resolution
process.env.NODE_PATH = path.join(projectRoot, "src");

// Import after path setup
const args = process.argv.slice(2);
const isCheckOnly = args.includes("--check");
const isVerbose = args.includes("--verbose");

// Dynamic import to work with Next.js
const { archiveExpiredUrgentPosts, countExpiredUrgentPosts, getExpiredUrgentPosts } = await import(
  path.join(projectRoot, "src/lib/community-urgent-expiration.ts")
);

async function main() {
  console.log("🔄 Processing expired urgent community posts...");
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);

  try {
    const expiredCount = await countExpiredUrgentPosts();
    console.log(`📊 Found ${expiredCount} expired urgent posts`);

    if (expiredCount === 0) {
      console.log("✅ No expired urgent posts to process");
      return;
    }

    if (isCheckOnly) {
      console.log("🔍 Check-only mode: not archiving (use --check flag)");

      if (isVerbose) {
        console.log("\n📋 Expired posts:");
        const posts = await getExpiredUrgentPosts(10);
        posts.forEach((post, idx) => {
          console.log(`  ${idx + 1}. ${post.title}`);
          console.log(`     ID: ${post._id}`);
          console.log(`     Expired: ${new Date(post.urgentExpiresAt).toISOString()}`);
          console.log(`     Status: ${post.status}`);
        });
      }
      return;
    }

    // Archive the posts
    const result = await archiveExpiredUrgentPosts();
    console.log(`✅ Archived ${result.modifiedCount} of ${result.matchedCount} matched posts`);

    if (isVerbose) {
      console.log(`📅 Processed at: ${result.timestamp.toISOString()}`);
    }

    console.log("✨ Done!");
  } catch (error) {
    console.error("❌ Error processing expired urgent posts:");
    console.error(error);
    process.exit(1);
  }
}

main();

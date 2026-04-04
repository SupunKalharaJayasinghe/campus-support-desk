# Urgent Post Expiration System

## Overview

This system automatically archives community posts that have passed their urgent expiration time. When a post is marked as urgent with a duration (2 days, 5 days, or 7 days), it gets an expiration timestamp. Once that time passes, the system can automatically move the post to "archived" status.

## Components

### 1. **Library Function** (`src/lib/community-urgent-expiration.ts`)

Core functions to manage urgent post expiration:

- `archiveExpiredUrgentPosts()` - Archives all expired urgent posts
- `countExpiredUrgentPosts()` - Count of posts that have expired but not archived
- `getExpiredUrgentPosts(limit)` - Get details of expired urgent posts

### 2. **CLI Script** (`scripts/archive-expired-urgent-posts.mjs`)

Run manually or via cron:

```bash
# Archive expired posts
npm run archive:urgent

# Check count only (no changes)
npm run archive:urgent:check

# View detailed list
npm run archive:urgent:details
```

### 3. **Admin API Endpoint** (`src/app/api/admin/urgent-expiration/route.ts`)

REST API for checking and archiving (admin-only):

```bash
# Check count
curl http://localhost:3000/api/admin/urgent-expiration?action=check

# Get details
curl http://localhost:3000/api/admin/urgent-expiration?action=details&limit=50

# Trigger archival
curl -X POST http://localhost:3000/api/admin/urgent-expiration?action=archive
```

## Usage Patterns

### Pattern 1: Manual Archival
Run on-demand when needed:
```bash
npm run archive:urgent
```

### Pattern 2: Scheduled Cron Job
Set up a cron job to run daily at 2 AM:
```bash
# Linux/Mac crontab entry
0 2 * * * cd /path/to/campus-support-desk && npm run archive:urgent >> /var/log/urgent-archive.log 2>&1
```

### Pattern 3: Admin Dashboard Trigger
Call the API endpoint from your admin panel to manually trigger archival.

### Pattern 4: Background Worker
Integrate with your background job queue system (e.g., Bull, Sidekiq):
```typescript
import { archiveExpiredUrgentPosts } from "@/lib/community-urgent-expiration";

// In your job handler
await archiveExpiredUrgentPosts();
```

## How It Works

### Before Archival
```
Post (urgent) → urgentExpiresAt: 2024-04-06 15:30:00
             → status: "open"
             → isUrgent: true
```

### After Expiration
```
Post (expired) → urgentExpiresAt: 2024-04-06 15:30:00  (unchanged)
              → status: "archived"  (changed)
              → isUrgent: true  (unchanged - tracks history)
```

### Key Features
- ✅ Preserves `isUrgent` flag for history/analytics
- ✅ Preserves `status2` (resolved/not_resolved) to maintain resolution state
- ✅ Only archives posts that haven't been archived already
- ✅ Shows which posts expired and when
- ✅ Admin API for monitoring

## Monitoring

### Check for expired posts
```bash
npm run archive:urgent:check
# Output: Found 5 expired urgent posts
```

### View expired post details
```bash
npm run archive:urgent:details
# Shows title, ID, expiration time, status
```

### API monitoring
```bash
# GET - Check count
GET /api/admin/urgent-expiration?action=check

# GET - View details
GET /api/admin/urgent-expiration?action=details&limit=100

# POST - Trigger archive
POST /api/admin/urgent-expiration?action=archive
```

## Configuration

No configuration needed! The system uses the `urgentExpiresAt` field already stored in each post.

Optional: Adjust archival logic in `src/lib/community-urgent-expiration.ts` for different behavior (e.g., auto-resolve instead of archive).

## Future Enhancements

1. **Webhook notification** - Notify post author when urgent expires
2. **Auto-extend** - Allow users to extend expiration for a fee
3. **Bulk re-archive** - Support archiving old non-urgent posts too
4. **Email notification** - Alert admins of expiration stats
5. **Metrics dashboard** - Track urgent post conversions/ROI

## Troubleshooting

**Q: Script says "No expired urgent posts" but there should be some**
A: Check if `urgentExpiresAt` is set correctly on posts in MongoDB.

**Q: Posts not moving to "archived" status**
A: Verify the user running the script has database write permissions.

**Q: How do I undo an archival?**
A: Reset status to "open" manually:
```javascript
db.community_posts.updateOne(
  { _id: ObjectId("...") },
  { $set: { status: "open" } }
);
```

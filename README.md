# Campus Support Desk (UniHub)

Role-based campus portal UI built with Next.js (App Router) + Tailwind CSS.
This repo currently focuses on the **frontend experience** (sample/demo data) and basic route-level guards.

## Requirements

- Node.js 20+ recommended
- npm (comes with Node)

## Getting started (dev)

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

If port `3000` is busy:

```powershell
$env:PORT=3004; npm run dev
```

## Admin dashboard

Open: `http://localhost:3000/admin`

### Demo mode (recommended for UI testing)

Create a `.env.local` file (it is git-ignored) with:

```bash
NEXT_PUBLIC_DEMO_MODE=true
```

When demo mode is enabled, route guarding is bypassed so you can open role pages directly.

### MongoDB mode (real login/API persistence)

If you want database-backed login and API persistence, use:

```bash
NEXT_PUBLIC_DEMO_MODE=false
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<db>?retryWrites=true&w=majority
MONGODB_DB=campus_support_desk
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@campus.local
ADMIN_PASSWORD=Admin@12345
```

Then seed an admin user:

```bash
npm run seed:admin
```

`seed:admin` creates or updates an active `ADMIN` account.

### Login (when demo mode is disabled)

If you set `NEXT_PUBLIC_DEMO_MODE=false` (or remove it), role pages are guarded:

1. Open `http://localhost:3000/login`
2. Sign in with your MongoDB-backed user (for seeded admin: `admin` / `Admin@12345` by default)
3. Open `http://localhost:3000/admin`

The app stores a demo session in `localStorage` using:

- `unihub_role`
- `unihub_user`

Guard logic lives in `src/components/auth/RoleGuard.tsx`.

## Useful routes

- `/` landing page
- `/login` demo login (role picker)
- `/admin` admin dashboard
- `/admin/users` user management (demo UI)
- `/admin/faculty` faculty/program structure (demo UI)
- `/admin/groups` grouping (demo UI)
- `/admin/notifications` announcements/notifications (demo UI)
- `/admin/settings` settings (demo UI)
- `/api/health` health endpoint (returns `{ ok: true, ... }`)

## Scripts

- `npm run dev` start dev server
- `npm run seed:admin` create/update MongoDB admin login user
- `npm run build` production build
- `npm run start` start production server (after build)
- `npm run lint` run ESLint

## Project structure (high level)

- `src/app` Next.js routes (App Router)
  - `src/app/(app)` role dashboards (admin/student/lecturer/lost-items)
  - `src/app/api` API routes
- `src/components` UI + layout components
- `src/lib` helpers (RBAC, nav config, etc.)

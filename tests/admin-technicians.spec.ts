import { expect, test, type Page } from "@playwright/test";

const ROLE_STORAGE_KEY = "unihub_role";
const USER_STORAGE_KEY = "unihub_user";

const superAdminUser = {
  id: "507f1f77bcf86cd799439011",
  name: "Playwright Admin",
  role: "SUPER_ADMIN" as const,
  userRole: "ADMIN",
  mustChangePassword: false,
};

const seedTechnicians = [
  {
    id: "507f1f77bcf86cd799430001",
    fullName: "Nimal Perera",
    username: "nimal.tech",
    email: "nimal.tech@example.edu",
    specialization: "Technical",
    status: "ACTIVE",
    mustChangePassword: false,
    updatedAt: "2025-01-20T10:30:00.000Z",
    createdAt: "2025-01-18T08:00:00.000Z",
  },
  {
    id: "507f1f77bcf86cd799430002",
    fullName: "Kamal Silva",
    username: "kamal.tech",
    email: "kamal.tech@example.edu",
    specialization: "Network",
    status: "INACTIVE",
    mustChangePassword: true,
    updatedAt: "2025-01-19T10:30:00.000Z",
    createdAt: "2025-01-17T08:00:00.000Z",
  },
  {
    id: "507f1f77bcf86cd799430003",
    fullName: "Anuja Fernando",
    username: "anuja.tech",
    email: "anuja.tech@example.edu",
    specialization: "Hardware",
    status: "ACTIVE",
    mustChangePassword: false,
    updatedAt: "2025-01-21T10:30:00.000Z",
    createdAt: "2025-01-20T08:00:00.000Z",
  },
];

async function seedAdminSession(page: Page) {
  await page.addInitScript(
    ([roleKey, userKey, userJson]) => {
      window.localStorage.setItem(roleKey, JSON.parse(userJson).role);
      window.localStorage.setItem(userKey, userJson);
    },
    [ROLE_STORAGE_KEY, USER_STORAGE_KEY, JSON.stringify(superAdminUser)]
  );
}

function applyListFilters(rows: typeof seedTechnicians, url: URL) {
  const search = String(url.searchParams.get("search") ?? "").trim().toLowerCase();
  const status = String(url.searchParams.get("status") ?? "").trim();
  const sort = String(url.searchParams.get("sort") ?? "updated");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = [10, 25, 50, 100].includes(Number(url.searchParams.get("pageSize")))
    ? Number(url.searchParams.get("pageSize"))
    : 10;

  let filtered = rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (!search) return true;
    return [row.fullName, row.username, row.email, row.specialization]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });

  filtered = [...filtered].sort((a, b) => {
    if (sort === "az") return a.fullName.localeCompare(b.fullName);
    if (sort === "za") return b.fullName.localeCompare(a.fullName);
    if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);
  return { items, total, page, pageSize };
}

async function installTechnicianApiMock(page: Page, initialRows = seedTechnicians) {
  let rows = [...initialRows];
  let listRequestCount = 0;

  await page.route("**/api/technicians**", async (route) => {
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    const pathname = url.pathname;

    if ((pathname === "/api/technicians" || pathname === "/api/technicians/") && method === "GET") {
      listRequestCount += 1;
      const payload = applyListFilters(rows, url);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });
      return;
    }

    if ((pathname === "/api/technicians" || pathname === "/api/technicians/") && method === "POST") {
      const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      const fullName = String(body.fullName ?? "").trim();
      const email = String(body.email ?? "").trim();
      const username = String(body.username ?? "").trim();
      if (!fullName || !email || !username) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ message: "Full name, username, and email are required" }),
        });
        return;
      }
      const created = {
        id: `mock-${rows.length + 1}`,
        fullName,
        username,
        email,
        specialization: String(body.specialization ?? "").trim(),
        status: String(body.status ?? "ACTIVE").trim() === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        mustChangePassword: true,
        updatedAt: "2025-01-22T08:00:00.000Z",
        createdAt: "2025-01-22T08:00:00.000Z",
      };
      rows = [created, ...rows];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ item: created, generatedPassword: "temp-pass-123" }),
      });
      return;
    }

    if (pathname.startsWith("/api/technicians/") && method === "PUT") {
      const id = decodeURIComponent(pathname.replace("/api/technicians/", ""));
      const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      rows = rows.map((row) =>
        row.id === id
          ? {
              ...row,
              fullName: String(body.fullName ?? row.fullName),
              username: String(body.username ?? row.username),
              email: String(body.email ?? row.email),
              specialization: String(body.specialization ?? row.specialization),
              status: String(body.status ?? row.status) === "INACTIVE" ? "INACTIVE" : "ACTIVE",
              mustChangePassword:
                typeof body.mustChangePassword === "boolean"
                  ? body.mustChangePassword
                  : row.mustChangePassword,
              updatedAt: "2025-01-22T09:00:00.000Z",
            }
          : row
      );
      const updated = rows.find((row) => row.id === id);
      await route.fulfill({
        status: updated ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(updated ?? { message: "Technician user not found" }),
      });
      return;
    }

    if (pathname.startsWith("/api/technicians/") && method === "DELETE") {
      const id = decodeURIComponent(pathname.replace("/api/technicians/", ""));
      const before = rows.length;
      rows = rows.filter((row) => row.id !== id);
      await route.fulfill({
        status: rows.length < before ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(rows.length < before ? { ok: true } : { message: "Technician user not found" }),
      });
      return;
    }

    await route.fallback();
  });

  return {
    getListRequestCount: () => listRequestCount,
  };
}

test.describe("admin technicians page", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await seedAdminSession(page);
  });

  test("shows technicians dashboard and list", async ({ page }) => {
    await installTechnicianApiMock(page);
    await page.goto("http://localhost:3000/admin/users/technicians");

    await expect(page.getByRole("heading", { name: "Technician accounts" })).toBeVisible();
    await expect(page.getByText("Total Technicians", { exact: true })).toBeVisible();
    await expect(page.getByText("Active Technicians", { exact: true })).toBeVisible();
    await expect(page.getByText("Technician records", { exact: true })).toBeVisible();
    await expect(page.getByText("Nimal Perera", { exact: true })).toBeVisible();
    await expect(page.getByText("Kamal Silva", { exact: true })).toBeVisible();
    await expect(page.getByText("Anuja Fernando", { exact: true })).toBeVisible();
  });

  test("searches, filters by status, sorts, and clears filters", async ({ page }) => {
    await installTechnicianApiMock(page);
    await page.goto("http://localhost:3000/admin/users/technicians");

    const search = page.getByLabel("Search technicians");
    const sortSelect = page.getByLabel("Sort technicians");
    const statusFilter = page.getByLabel("Filter technicians by status");

    await search.fill("kamal");
    await expect(page.getByText("Kamal Silva", { exact: true })).toBeVisible();
    await expect(page.getByText("Nimal Perera", { exact: true })).not.toBeVisible();

    await statusFilter.selectOption("INACTIVE");
    await expect(page.getByText("Kamal Silva", { exact: true })).toBeVisible();
    await expect(page.getByText("Anuja Fernando", { exact: true })).not.toBeVisible();

    await sortSelect.selectOption("az");
    await expect(page.getByText("Status filter applied").first()).toBeVisible();

    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(page.getByText("No status filter").first()).toBeVisible();
    await expect(page.getByText("Nimal Perera", { exact: true })).toBeVisible();
    await expect(page.getByText("Anuja Fernando", { exact: true })).toBeVisible();
  });

  test("validates required fields and creates a new technician", async ({ page }) => {
    await installTechnicianApiMock(page);
    await page.goto("http://localhost:3000/admin/users/technicians");

    await page.getByRole("button", { name: "Add Technician" }).click();
    const dialog = page.getByRole("dialog");

    await expect(dialog.getByText("Add Technician", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText("Full name is required")).toBeVisible();

    await dialog.locator("input").nth(0).fill("Ruwan Dias");
    await dialog.locator("input").nth(1).fill("ruwan.tech@example.edu");
    await dialog.locator("input").nth(2).fill("ruwan.tech");
    await dialog.locator("select").nth(0).selectOption("Technical");
    await dialog.locator("select").nth(1).selectOption("ACTIVE");
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Ruwan Dias", { exact: true })).toBeVisible();
    await expect(page.getByText("ruwan.tech@example.edu", { exact: true })).toBeVisible();
  });

  test("edits an existing technician", async ({ page }) => {
    await installTechnicianApiMock(page);
    await page.goto("http://localhost:3000/admin/users/technicians");

    await page.getByRole("button", { name: "Edit Nimal Perera" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Edit Technician", { exact: true })).toBeVisible();

    await dialog.locator("input").nth(0).fill("Nimal Perera Updated");
    await dialog.locator("select").nth(1).selectOption("INACTIVE");
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Nimal Perera Updated", { exact: true })).toBeVisible();
    const updatedRow = page.locator("tr", { hasText: "Nimal Perera Updated" });
    await expect(updatedRow.getByText("INACTIVE", { exact: true }).first()).toBeVisible();
  });

  test("deletes a technician record", async ({ page }) => {
    await installTechnicianApiMock(page);
    await page.goto("http://localhost:3000/admin/users/technicians");

    await page.getByRole("button", { name: "Delete Kamal Silva" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Delete Technician", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("Kamal Silva", { exact: true })).toHaveCount(0);
  });

  test("shows empty state and can reload list", async ({ page }) => {
    const mock = await installTechnicianApiMock(page, []);
    await page.goto("http://localhost:3000/admin/users/technicians");

    await expect(page.getByText("No technicians match the current filters.")).toBeVisible();
    await expect.poll(() => mock.getListRequestCount()).toBeGreaterThan(0);

    await page.reload();
    await expect.poll(() => mock.getListRequestCount()).toBeGreaterThan(1);
  });
});

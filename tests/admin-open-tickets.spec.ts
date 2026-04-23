import { expect, test, type Page } from "@playwright/test";

const ROLE_STORAGE_KEY = "unihub_role";
const USER_STORAGE_KEY = "unihub_user";

test.setTimeout(60_000);

const superAdminUser = {
  id: "507f1f77bcf86cd799439011",
  name: "Playwright Admin",
  role: "SUPER_ADMIN" as const,
  userRole: "ADMIN",
  mustChangePassword: false,
};

const technicianUser = {
  id: "507f1f77bcf86cd799439012",
  name: "Playwright Technician",
  role: "TECHNICIAN" as const,
  userRole: "TECHNICIAN",
  mustChangePassword: false,
};

const mockOpenTickets = [
  {
    id: "507f1f77bcf86cd799439021",
    subject: "Lab printer not responding",
    category: "Technical",
    subcategory: "Hardware",
    description: "Printer in lab 2 shows paper jam even after reset.",
    contactEmail: "student1@example.edu",
    contactPhone: "",
    contactWhatsapp: "",
    priority: "High",
    status: "Open",
    createdAt: "2025-01-20T10:30:00.000Z",
    updatedAt: "2025-01-20T10:30:00.000Z",
    student: {
      id: "507f1f77bcf86cd799439031",
      studentId: "STU001",
      name: "Alice Perera",
      email: "alice@example.edu",
    },
    studentEvidencePreview: [],
    assignedTechnician: null,
    technicianComments: "",
    technicianEvidencePreview: [],
  },
  {
    id: "507f1f77bcf86cd799439022",
    subject: "Portal login timeout",
    category: "Technical",
    subcategory: "Login",
    description: "Login session expires immediately after signing in.",
    contactEmail: "student2@example.edu",
    contactPhone: "0771234567",
    contactWhatsapp: "",
    priority: "Medium",
    status: "Open",
    createdAt: "2025-01-18T08:00:00.000Z",
    updatedAt: "2025-01-19T12:00:00.000Z",
    student: {
      id: "507f1f77bcf86cd799439032",
      studentId: "STU002",
      name: "Kamal Silva",
      email: "kamal@example.edu",
    },
    studentEvidencePreview: [
      {
        fileName: "timeout-screenshot.png",
        mimeType: "image/png",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAGgwJ/lx6pYQAAAABJRU5ErkJggg==",
      },
    ],
    assignedTechnician: {
      id: "507f1f77bcf86cd799439041",
      fullName: "Nimal Tech",
      username: "nimal.tech",
      email: "nimal.tech@example.edu",
      specialization: "Network",
    },
    technicianComments: "Restarted auth service and collecting logs.",
    technicianEvidencePreview: [
      {
        fileName: "diagnostic-report.txt",
        mimeType: "text/plain",
        data: "SGVsbG8gd29ybGQ=",
      },
    ],
  },
];

async function seedSession(page: Page, user: typeof superAdminUser | typeof technicianUser) {
  await page.addInitScript(
    ([roleKey, userKey, userJson]) => {
      window.localStorage.setItem(roleKey, JSON.parse(userJson).role);
      window.localStorage.setItem(userKey, userJson);
    },
    [ROLE_STORAGE_KEY, USER_STORAGE_KEY, JSON.stringify(user)]
  );
}

test.describe("admin open tickets page", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await seedSession(page, superAdminUser);
  });

  test("shows open tickets list from API", async ({ page }) => {
    await page.route("**/api/admin/support-tickets**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("status") !== "Open") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: mockOpenTickets, total: mockOpenTickets.length }),
      });
    });

    await page.goto("http://localhost:3000/admin/tickets/open");

    await expect(page.getByRole("heading", { name: "Open support tickets" })).toBeVisible();
    await expect(page.getByText("Support requests that are still in the Open state")).toBeVisible();
    await expect(page.getByText("Open tickets", { exact: true })).toBeVisible();
    await expect(page.getByText("Showing 2 of 2")).toBeVisible();
    await expect(page.getByText("Lab printer not responding", { exact: true })).toBeVisible();
    await expect(page.getByText("Portal login timeout", { exact: true })).toBeVisible();
  });

  test("filters by search, priority, category, assignment and can clear filters", async ({ page }) => {
    await page.route("**/api/admin/support-tickets**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: mockOpenTickets, total: mockOpenTickets.length }),
      });
    });

    await page.goto("http://localhost:3000/admin/tickets/open");

    const prioritySelect = page.locator("select").nth(0);
    const categorySelect = page.locator("select").nth(1);
    const assignmentSelect = page.locator("select").nth(2);

    await expect(page.getByText("Showing 2 of 2")).toBeVisible();
    const search = page.getByPlaceholder("Subject, student, technician, category...");
    await search.fill("timeout");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await expect(page.getByText("Portal login timeout", { exact: true })).toBeVisible();
    await expect(page.getByText("Lab printer not responding", { exact: true })).not.toBeVisible();

    await search.fill("");
    await prioritySelect.selectOption("High");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await expect(page.getByText("Lab printer not responding", { exact: true })).toBeVisible();

    await prioritySelect.selectOption("all");
    await categorySelect.selectOption("Login");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await expect(page.getByText("Portal login timeout", { exact: true })).toBeVisible();

    await assignmentSelect.selectOption("unassigned");
    await expect(page.getByText("Showing 0 of 2")).toBeVisible();
    await expect(page.getByText("No tickets match the selected filters.")).toBeVisible();

    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByText("Showing 2 of 2")).toBeVisible();
  });

  test("expands and collapses ticket details", async ({ page }) => {
    await page.route("**/api/admin/support-tickets**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: mockOpenTickets, total: mockOpenTickets.length }),
      });
    });

    await page.goto("http://localhost:3000/admin/tickets/open");

    const detailsButton = page.getByRole("button", { name: "See details" }).first();
    await detailsButton.click();

    await expect(page.getByText("Student ticket details")).toBeVisible();
    await expect(page.getByText("Technician details", { exact: true })).toBeVisible();
    await expect(page.getByText("Alice Perera", { exact: false })).toBeVisible();
    await expect(page.getByText("No student evidence attached.")).toBeVisible();

    await page.getByRole("button", { name: "Hide details" }).first().click();
    await expect(page.getByText("Student ticket details")).not.toBeVisible();
  });

  test("shows assign technician for super admin and hides it for technician", async ({ page }) => {
    await page.route("**/api/admin/support-tickets**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: mockOpenTickets, total: mockOpenTickets.length }),
      });
    });

    await page.goto("http://localhost:3000/admin/tickets/open");
    await expect(page.getByRole("button", { name: "Assign technician" }).first()).toBeVisible();

    await seedSession(page, technicianUser);
    await page.reload();

    await expect(page.getByRole("button", { name: "Assign technician" })).toHaveCount(0);
  });

  test("refresh action triggers a reload request", async ({ page }) => {
    let requestCount = 0;
    await page.route("**/api/admin/support-tickets**", async (route) => {
      requestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: mockOpenTickets, total: mockOpenTickets.length }),
      });
    });

    await page.goto("http://localhost:3000/admin/tickets/open");
    await expect.poll(() => requestCount).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Refresh" }).click();
    await expect.poll(() => requestCount).toBeGreaterThan(1);
  });
});

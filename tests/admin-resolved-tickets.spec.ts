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

const technicianUser = {
  id: "507f1f77bcf86cd799439012",
  name: "Playwright Technician",
  role: "TECHNICIAN" as const,
  userRole: "TECHNICIAN",
  mustChangePassword: false,
};

const mockResolvedTickets = [
  {
    id: "507f1f77bcf86cd799439501",
    subject: "Library kiosk printer fixed",
    category: "Technical",
    subcategory: "Hardware",
    description: "Printer driver was reinstalled and test pages are printing.",
    contactEmail: "student@example.edu",
    contactPhone: "",
    contactWhatsapp: "",
    priority: "Medium",
    status: "Resolved",
    createdAt: "2025-01-14T09:00:00.000Z",
    updatedAt: "2025-01-16T15:00:00.000Z",
    student: {
      id: "507f1f77bcf86cd799439601",
      studentId: "STU205",
      name: "Ishara Peris",
      email: "ishara@example.edu",
    },
    studentEvidencePreview: [],
    assignedTechnician: {
      id: "507f1f77bcf86cd799439701",
      fullName: "Ruwan Tech",
      username: "ruwan.tech",
      email: "ruwan.tech@example.edu",
      specialization: "Hardware",
    },
    technicianComments: "Issue verified with user and marked as resolved.",
    technicianEvidencePreview: [],
  },
  {
    id: "507f1f77bcf86cd799439502",
    subject: "Student portal password reset completed",
    category: "Software",
    subcategory: "Login",
    description: "Password reset issue resolved after identity verification.",
    contactEmail: "student2@example.edu",
    contactPhone: "0777777777",
    contactWhatsapp: "",
    priority: "High",
    status: "Resolved",
    createdAt: "2025-01-17T11:00:00.000Z",
    updatedAt: "2025-01-17T12:00:00.000Z",
    student: {
      id: "507f1f77bcf86cd799439602",
      studentId: "STU206",
      name: "Sashini Kalhara",
      email: "sashini@example.edu",
    },
    studentEvidencePreview: [],
    assignedTechnician: null,
    technicianComments: "",
    technicianEvidencePreview: [],
  },
];

async function seedSession(
  page: Page,
  user: typeof superAdminUser | typeof technicianUser
) {
  await page.addInitScript(
    ([roleKey, userKey, userJson]) => {
      window.localStorage.setItem(roleKey, JSON.parse(userJson).role);
      window.localStorage.setItem(userKey, userJson);
    },
    [ROLE_STORAGE_KEY, USER_STORAGE_KEY, JSON.stringify(user)]
  );
}

async function mockResolvedApi(page: Page, items = mockResolvedTickets) {
  await page.route("**/api/admin/support-tickets**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("status") !== "Resolved") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items,
        total: items.length,
      }),
    });
  });
}

test.describe("admin resolved tickets page", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await seedSession(page, superAdminUser);
  });

  test("shows resolved tickets list from API", async ({ page }) => {
    await mockResolvedApi(page);
    await page.goto("http://localhost:3000/admin/tickets/resolved");

    await expect(
      page.getByRole("heading", { name: "Resolved support tickets" })
    ).toBeVisible();
    await expect(page.getByText("Tickets that have been marked as resolved.")).toBeVisible();
    await expect(page.getByText("Resolved tickets", { exact: true })).toBeVisible();
    await expect(page.getByText("Showing 2 of 2")).toBeVisible();
    await expect(page.getByText("Library kiosk printer fixed", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Student portal password reset completed", { exact: true })
    ).toBeVisible();
  });

  test("filters by search, priority, category, assignment and clears filters", async ({
    page,
  }) => {
    await mockResolvedApi(page);
    await page.goto("http://localhost:3000/admin/tickets/resolved");

    const prioritySelect = page.locator("select").nth(0);
    const categorySelect = page.locator("select").nth(1);
    const assignmentSelect = page.locator("select").nth(2);
    const search = page.getByPlaceholder("Subject, student, technician, category...");

    await expect(page.getByText("Showing 2 of 2")).toBeVisible();

    await search.fill("kiosk");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await expect(page.getByText("Library kiosk printer fixed", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Student portal password reset completed", { exact: true })
    ).not.toBeVisible();

    await search.fill("");
    await prioritySelect.selectOption("High");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await expect(
      page.getByText("Student portal password reset completed", { exact: true })
    ).toBeVisible();

    await prioritySelect.selectOption("all");
    await categorySelect.selectOption("Hardware");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await expect(page.getByText("Library kiosk printer fixed", { exact: true })).toBeVisible();

    await categorySelect.selectOption("all");
    await assignmentSelect.selectOption("unassigned");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await expect(
      page.getByText("Student portal password reset completed", { exact: true })
    ).toBeVisible();

    await assignmentSelect.selectOption("assigned");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await expect(page.getByText("Library kiosk printer fixed", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByText("Showing 2 of 2")).toBeVisible();
  });

  test("shows no-results message when filters remove all rows", async ({ page }) => {
    await mockResolvedApi(page);
    await page.goto("http://localhost:3000/admin/tickets/resolved");

    const search = page.getByPlaceholder("Subject, student, technician, category...");
    await search.fill("not-in-any-ticket");

    await expect(page.getByText("Showing 0 of 2")).toBeVisible();
    await expect(page.getByText("No tickets match the selected filters.")).toBeVisible();
  });

  test("expands and collapses ticket details", async ({ page }) => {
    await mockResolvedApi(page);
    await page.goto("http://localhost:3000/admin/tickets/resolved");

    const detailsButton = page.getByRole("button", { name: "See details" }).first();
    await detailsButton.click();

    await expect(page.getByText("Student ticket details")).toBeVisible();
    await expect(page.getByText("Technician details", { exact: true })).toBeVisible();
    await expect(page.getByText("Ishara Peris", { exact: false })).toBeVisible();
    await expect(
      page.getByText("Issue verified with user and marked as resolved.")
    ).toBeVisible();

    await page.getByRole("button", { name: "Hide details" }).first().click();
    await expect(page.getByText("Student ticket details")).not.toBeVisible();
  });

  test("refresh action triggers a reload request", async ({ page }) => {
    let requestCount = 0;
    await page.route("**/api/admin/support-tickets**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("status") !== "Resolved") {
        await route.fallback();
        return;
      }
      requestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: mockResolvedTickets,
          total: mockResolvedTickets.length,
        }),
      });
    });

    await page.goto("http://localhost:3000/admin/tickets/resolved");
    await expect.poll(() => requestCount).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Refresh" }).click();
    await expect.poll(() => requestCount).toBeGreaterThan(1);
  });

  test("shows empty-state message when API returns no items", async ({ page }) => {
    await mockResolvedApi(page, []);
    await page.goto("http://localhost:3000/admin/tickets/resolved");
    await expect(page.getByText("No resolved support tickets to show yet.")).toBeVisible();
  });

  test("does not show assign technician action on resolved page", async ({ page }) => {
    await mockResolvedApi(page);
    await page.goto("http://localhost:3000/admin/tickets/resolved");
    await expect(page.getByRole("button", { name: "Assign technician" })).toHaveCount(0);

    await seedSession(page, technicianUser);
    await page.reload();
    await expect(page.getByRole("button", { name: "Assign technician" })).toHaveCount(0);
  });
});

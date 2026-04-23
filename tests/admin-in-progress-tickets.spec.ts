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

const mockInProgressTickets = [
  {
    id: "507f1f77bcf86cd799439101",
    subject: "Smart classroom panel calibration issue",
    category: "Technical",
    subcategory: "Hardware",
    description: "Touch panel drifts and cannot select accurate coordinates.",
    contactEmail: "student@example.edu",
    contactPhone: "",
    contactWhatsapp: "",
    priority: "High",
    status: "In progress",
    createdAt: "2025-01-20T10:30:00.000Z",
    updatedAt: "2025-01-20T11:30:00.000Z",
    student: {
      id: "507f1f77bcf86cd799439201",
      studentId: "STU101",
      name: "Nadeesha Fernando",
      email: "nadeesha@example.edu",
    },
    studentEvidencePreview: [],
    assignedTechnician: {
      id: "507f1f77bcf86cd799439301",
      fullName: "Sahan Tech",
      username: "sahan.tech",
      email: "sahan.tech@example.edu",
      specialization: "Hardware",
    },
    technicianComments: "Calibration tool installed. Testing precision now.",
    technicianEvidencePreview: [],
  },
  {
    id: "507f1f77bcf86cd799439102",
    subject: "LMS attendance sync delay",
    category: "Software",
    subcategory: "Login",
    description: "Attendance updates appear after a long delay for lecturers.",
    contactEmail: "lecturer@example.edu",
    contactPhone: "0775551234",
    contactWhatsapp: "",
    priority: "Medium",
    status: "In progress",
    createdAt: "2025-01-19T07:30:00.000Z",
    updatedAt: "2025-01-20T09:15:00.000Z",
    student: {
      id: "507f1f77bcf86cd799439202",
      studentId: "STU102",
      name: "Kasun Jayasinghe",
      email: "kasun@example.edu",
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

async function mockInProgressApi(page: Page, items = mockInProgressTickets) {
  await page.route("**/api/admin/support-tickets**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("status") !== "In progress") {
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

test.describe("admin in-progress tickets page", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await seedSession(page, superAdminUser);
  });

  test("shows in-progress tickets list from API", async ({ page }) => {
    await mockInProgressApi(page);
    await page.goto("http://localhost:3000/admin/tickets/in-progress");

    await expect(
      page.getByRole("heading", { name: "In progress support tickets" })
    ).toBeVisible();
    await expect(
      page.getByText("Tickets currently being worked on by staff (status In progress).")
    ).toBeVisible();
    await expect(page.getByText("In progress tickets", { exact: true })).toBeVisible();
    await expect(page.getByText("Showing 2 of 2")).toBeVisible();
    await expect(
      page.getByText("Smart classroom panel calibration issue", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("LMS attendance sync delay", { exact: true })).toBeVisible();
  });

  test("filters by search, priority, category, assignment and clears filters", async ({
    page,
  }) => {
    await mockInProgressApi(page);
    await page.goto("http://localhost:3000/admin/tickets/in-progress");

    const prioritySelect = page.locator("select").nth(0);
    const categorySelect = page.locator("select").nth(1);
    const assignmentSelect = page.locator("select").nth(2);
    const search = page.getByPlaceholder("Subject, student, technician, category...");

    await expect(page.getByText("Showing 2 of 2")).toBeVisible();

    await search.fill("calibration");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await expect(
      page.getByText("Smart classroom panel calibration issue", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("LMS attendance sync delay", { exact: true })).not.toBeVisible();

    await search.fill("");
    await prioritySelect.selectOption("Medium");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await expect(page.getByText("LMS attendance sync delay", { exact: true })).toBeVisible();

    await prioritySelect.selectOption("all");
    await categorySelect.selectOption("Hardware");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await expect(
      page.getByText("Smart classroom panel calibration issue", { exact: true })
    ).toBeVisible();

    await categorySelect.selectOption("all");
    await assignmentSelect.selectOption("unassigned");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await expect(page.getByText("LMS attendance sync delay", { exact: true })).toBeVisible();

    await assignmentSelect.selectOption("assigned");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await expect(
      page.getByText("Smart classroom panel calibration issue", { exact: true })
    ).toBeVisible();

    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByText("Showing 2 of 2")).toBeVisible();
  });

  test("shows no-results message when filters remove all rows", async ({ page }) => {
    await mockInProgressApi(page);
    await page.goto("http://localhost:3000/admin/tickets/in-progress");

    const search = page.getByPlaceholder("Subject, student, technician, category...");
    await search.fill("does-not-exist");

    await expect(page.getByText("Showing 0 of 2")).toBeVisible();
    await expect(page.getByText("No tickets match the selected filters.")).toBeVisible();
  });

  test("expands and collapses ticket details", async ({ page }) => {
    await mockInProgressApi(page);
    await page.goto("http://localhost:3000/admin/tickets/in-progress");

    const detailsButton = page.getByRole("button", { name: "See details" }).first();
    await detailsButton.click();

    await expect(page.getByText("Student ticket details")).toBeVisible();
    await expect(page.getByText("Technician details", { exact: true })).toBeVisible();
    await expect(page.getByText("Nadeesha Fernando", { exact: false })).toBeVisible();
    await expect(
      page.getByText("Calibration tool installed. Testing precision now.")
    ).toBeVisible();

    await page.getByRole("button", { name: "Hide details" }).first().click();
    await expect(page.getByText("Student ticket details")).not.toBeVisible();
  });

  test("refresh action triggers a reload request", async ({ page }) => {
    let requestCount = 0;
    await page.route("**/api/admin/support-tickets**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("status") !== "In progress") {
        await route.fallback();
        return;
      }
      requestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: mockInProgressTickets,
          total: mockInProgressTickets.length,
        }),
      });
    });

    await page.goto("http://localhost:3000/admin/tickets/in-progress");
    await expect.poll(() => requestCount).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Refresh" }).click();
    await expect.poll(() => requestCount).toBeGreaterThan(1);
  });

  test("shows empty-state message when API returns no items", async ({ page }) => {
    await mockInProgressApi(page, []);
    await page.goto("http://localhost:3000/admin/tickets/in-progress");

    await expect(page.getByText("No in-progress support tickets right now.")).toBeVisible();
  });

  test("does not show assign technician action on in-progress page", async ({ page }) => {
    await mockInProgressApi(page);
    await page.goto("http://localhost:3000/admin/tickets/in-progress");
    await expect(page.getByRole("button", { name: "Assign technician" })).toHaveCount(0);

    await seedSession(page, technicianUser);
    await page.reload();
    await expect(page.getByRole("button", { name: "Assign technician" })).toHaveCount(0);
  });
});

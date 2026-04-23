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

const mockWithdrawnTickets = [
  {
    id: "507f1f77bcf86cd799439801",
    subject: "Hostel room AC request cancelled",
    category: "Maintenance",
    subcategory: "Other",
    description: "Student withdrew request after issue was fixed independently.",
    contactEmail: "student@example.edu",
    contactPhone: "",
    contactWhatsapp: "",
    priority: "Low",
    status: "Withdrawn",
    createdAt: "2025-01-11T08:00:00.000Z",
    updatedAt: "2025-01-12T09:00:00.000Z",
    student: {
      id: "507f1f77bcf86cd799439901",
      studentId: "STU318",
      name: "Minali Gunasekara",
      email: "minali@example.edu",
    },
    studentEvidencePreview: [],
    assignedTechnician: null,
    technicianComments: "",
    technicianEvidencePreview: [],
  },
  {
    id: "507f1f77bcf86cd799439802",
    subject: "Parking permit request withdrawn",
    category: "Admin",
    subcategory: "Other",
    description: "Student withdrew the permit request after changing vehicle.",
    contactEmail: "student2@example.edu",
    contactPhone: "0771112233",
    contactWhatsapp: "",
    priority: "High",
    status: "Withdrawn",
    createdAt: "2025-01-13T10:00:00.000Z",
    updatedAt: "2025-01-13T12:00:00.000Z",
    student: {
      id: "507f1f77bcf86cd799439902",
      studentId: "STU319",
      name: "Raveen Silva",
      email: "raveen@example.edu",
    },
    studentEvidencePreview: [],
    assignedTechnician: {
      id: "507f1f77bcf86cd799439903",
      fullName: "Nuwan Tech",
      username: "nuwan.tech",
      email: "nuwan.tech@example.edu",
      specialization: "Admin",
    },
    technicianComments: "Request cancelled by student before processing.",
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

async function mockWithdrawnApi(page: Page, items = mockWithdrawnTickets) {
  await page.route("**/api/admin/support-tickets**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("status") !== "Withdrawn") {
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

test.describe("admin withdrawn tickets page", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await seedSession(page, superAdminUser);
  });

  test("shows withdrawn tickets list from API", async ({ page }) => {
    await mockWithdrawnApi(page);
    await page.goto("http://localhost:3000/admin/tickets/withdraw");

    await expect(
      page.getByRole("heading", { name: "Withdrawn support tickets" })
    ).toBeVisible();
    await expect(
      page.getByText("Tickets the student or admin withdrew before completion (status Withdrawn).")
    ).toBeVisible();
    await expect(page.getByText("Withdrawn tickets", { exact: true })).toBeVisible();
    await expect(page.getByText("Showing 2 of 2")).toBeVisible();
    await expect(page.getByText("Hostel room AC request cancelled", { exact: true })).toBeVisible();
    await expect(page.getByText("Parking permit request withdrawn", { exact: true })).toBeVisible();
  });

  test("filters by search, priority, category, assignment and clears filters", async ({
    page,
  }) => {
    await mockWithdrawnApi(page);
    await page.goto("http://localhost:3000/admin/tickets/withdraw");

    const prioritySelect = page.locator("select").nth(0);
    const categorySelect = page.locator("select").nth(1);
    const assignmentSelect = page.locator("select").nth(2);
    const search = page.getByPlaceholder("Subject, student, technician, category...");

    await expect(page.getByText("Showing 2 of 2")).toBeVisible();

    await search.fill("parking");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await expect(page.getByText("Parking permit request withdrawn", { exact: true })).toBeVisible();
    await expect(page.getByText("Hostel room AC request cancelled", { exact: true })).not.toBeVisible();

    await search.fill("");
    await prioritySelect.selectOption("Low");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await expect(page.getByText("Hostel room AC request cancelled", { exact: true })).toBeVisible();

    await prioritySelect.selectOption("all");
    await categorySelect.selectOption("Admin");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await expect(page.getByText("Parking permit request withdrawn", { exact: true })).toBeVisible();

    await categorySelect.selectOption("all");
    await assignmentSelect.selectOption("unassigned");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await expect(page.getByText("Hostel room AC request cancelled", { exact: true })).toBeVisible();

    await assignmentSelect.selectOption("assigned");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await expect(page.getByText("Parking permit request withdrawn", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByText("Showing 2 of 2")).toBeVisible();
  });

  test("shows no-results message when filters remove all rows", async ({ page }) => {
    await mockWithdrawnApi(page);
    await page.goto("http://localhost:3000/admin/tickets/withdraw");

    const search = page.getByPlaceholder("Subject, student, technician, category...");
    await search.fill("no-match-text");

    await expect(page.getByText("Showing 0 of 2")).toBeVisible();
    await expect(page.getByText("No tickets match the selected filters.")).toBeVisible();
  });

  test("expands and collapses ticket details", async ({ page }) => {
    await mockWithdrawnApi(page);
    await page.goto("http://localhost:3000/admin/tickets/withdraw");

    const detailsButton = page.getByRole("button", { name: "See details" }).first();
    await detailsButton.click();

    await expect(page.getByText("Student ticket details")).toBeVisible();
    await expect(page.getByText("Technician details", { exact: true })).toBeVisible();
    await expect(page.getByText("Minali Gunasekara", { exact: false })).toBeVisible();
    await expect(page.getByText("No student evidence attached.")).toBeVisible();

    await page.getByRole("button", { name: "Hide details" }).first().click();
    await expect(page.getByText("Student ticket details")).not.toBeVisible();
  });

  test("refresh action triggers a reload request", async ({ page }) => {
    let requestCount = 0;
    await page.route("**/api/admin/support-tickets**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("status") !== "Withdrawn") {
        await route.fallback();
        return;
      }
      requestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: mockWithdrawnTickets,
          total: mockWithdrawnTickets.length,
        }),
      });
    });

    await page.goto("http://localhost:3000/admin/tickets/withdraw");
    await expect.poll(() => requestCount).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Refresh" }).click();
    await expect.poll(() => requestCount).toBeGreaterThan(1);
  });

  test("shows empty-state message when API returns no items", async ({ page }) => {
    await mockWithdrawnApi(page, []);
    await page.goto("http://localhost:3000/admin/tickets/withdraw");
    await expect(page.getByText("No withdrawn support tickets right now.")).toBeVisible();
  });

  test("does not show assign technician action on withdrawn page", async ({ page }) => {
    await mockWithdrawnApi(page);
    await page.goto("http://localhost:3000/admin/tickets/withdraw");
    await expect(page.getByRole("button", { name: "Assign technician" })).toHaveCount(0);

    await seedSession(page, technicianUser);
    await page.reload();
    await expect(page.getByRole("button", { name: "Assign technician" })).toHaveCount(0);
  });
});

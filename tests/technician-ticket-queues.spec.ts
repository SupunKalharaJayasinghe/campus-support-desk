import { expect, test, type Page } from "@playwright/test";

const ROLE_STORAGE_KEY = "unihub_role";
const USER_STORAGE_KEY = "unihub_user";

const technicianUser = {
  id: "507f1f77bcf86cd799439012",
  name: "Playwright Technician",
  role: "TECHNICIAN" as const,
  userRole: "TECHNICIAN",
  username: "play.tech",
  email: "play.tech@example.edu",
  mustChangePassword: false,
};

const inProgressTickets = [
  {
    id: "507f1f77bcf86cd799440001",
    subject: "Wi-Fi issue in lab A",
    category: "Technical",
    subcategory: "Network",
    description: "Signal drops every 10 minutes during classes.",
    contactEmail: "student1@example.edu",
    contactPhone: "",
    contactWhatsapp: "",
    priority: "High",
    status: "In progress",
    createdAt: "2025-01-20T10:00:00.000Z",
    updatedAt: "2025-01-20T10:30:00.000Z",
    student: {
      id: "507f1f77bcf86cd799441001",
      studentId: "STU001",
      name: "Alice",
      email: "student1@example.edu",
    },
    studentEvidencePreview: [],
    assignedTechnician: {
      id: "507f1f77bcf86cd799442001",
      fullName: "Playwright Technician",
      username: "play.tech",
      email: "play.tech@example.edu",
      specialization: "Network",
    },
    technicianComments: "Checking router logs.",
    technicianEvidencePreview: [],
  },
  {
    id: "507f1f77bcf86cd799440002",
    subject: "Printer queue stuck",
    category: "Technical",
    subcategory: "Hardware",
    description: "Jobs remain pending and do not print.",
    contactEmail: "student2@example.edu",
    contactPhone: "0771234567",
    contactWhatsapp: "",
    priority: "Medium",
    status: "In progress",
    createdAt: "2025-01-20T08:00:00.000Z",
    updatedAt: "2025-01-20T08:15:00.000Z",
    student: {
      id: "507f1f77bcf86cd799441002",
      studentId: "STU002",
      name: "Bob",
      email: "student2@example.edu",
    },
    studentEvidencePreview: [],
    assignedTechnician: null,
    technicianComments: "",
    technicianEvidencePreview: [],
  },
];

const acceptedTickets = [
  {
    ...inProgressTickets[0],
    id: "507f1f77bcf86cd799440101",
    subject: "Projector HDMI port issue",
    status: "Accepted",
    priority: "High",
    category: "Technical",
    subcategory: "Hardware",
  },
  {
    ...inProgressTickets[1],
    id: "507f1f77bcf86cd799440102",
    subject: "Portal login intermittent failure",
    status: "Accepted",
    priority: "Low",
    category: "Software",
    subcategory: "Login",
  },
];

const resolvedTickets = [
  {
    ...acceptedTickets[0],
    id: "507f1f77bcf86cd799440201",
    subject: "Resolved: router firmware patch",
    status: "Resolved",
  },
];

async function seedTechnicianSession(page: Page) {
  await page.addInitScript(
    ([roleKey, userKey, userJson]) => {
      window.localStorage.setItem(roleKey, "TECHNICIAN");
      window.localStorage.setItem(userKey, userJson);
    },
    [ROLE_STORAGE_KEY, USER_STORAGE_KEY, JSON.stringify(technicianUser)]
  );
}

async function installQueueApiMock(
  page: Page,
  map: Record<string, unknown[]>
) {
  let listRequestCount = 0;
  let patchRequestCount = 0;
  let lastPatchBody: Record<string, unknown> | null = null;

  await page.route("**/api/admin/support-tickets**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("mine") !== "1") {
      await route.fallback();
      return;
    }
    const status = String(url.searchParams.get("status") ?? "");
    listRequestCount += 1;
    const items = map[status] ?? [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items, total: items.length }),
    });
  });

  await page.route("**/api/technician/support-tickets/**", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }
    patchRequestCount += 1;
    lastPatchBody = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  return {
    getListRequestCount: () => listRequestCount,
    getPatchRequestCount: () => patchRequestCount,
    getLastPatchBody: () => lastPatchBody,
  };
}

test.describe("technician ticket queues", () => {
  test("in-progress queue: list, filters, details, refresh, and accept action", async ({ page }) => {
    await seedTechnicianSession(page);
    const mock = await installQueueApiMock(page, { "In progress": inProgressTickets });

    await page.goto("http://localhost:3000/technician/tickets/in-progress");
    await expect(page.getByRole("heading", { name: "My in-progress tickets" })).toBeVisible();
    await expect(page.getByText("Showing 2 of 2")).toBeVisible();

    const search = page.getByPlaceholder("Subject, student, technician, category...");
    await search.fill("Wi-Fi");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();

    await search.fill("");
    await page.locator("select").nth(0).selectOption("Medium");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByText("Showing 2 of 2")).toBeVisible();

    await page.getByRole("button", { name: "See details" }).first().click();
    await expect(page.getByText("Student ticket details")).toBeVisible();
    await expect(page.getByText("Technician notes:")).toBeVisible();
    await page.getByRole("button", { name: "Hide details" }).first().click();

    await expect.poll(() => mock.getListRequestCount()).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect.poll(() => mock.getListRequestCount()).toBeGreaterThan(1);

    await page.getByRole("button", { name: "Accept ticket" }).first().click();
    await expect.poll(() => mock.getPatchRequestCount()).toBeGreaterThan(0);
    await expect.poll(() => mock.getLastPatchBody()?.status).toBe("Accepted");
  });

  test("in-progress queue: reject action, empty state and no-results message", async ({ page }) => {
    await seedTechnicianSession(page);
    const mock = await installQueueApiMock(page, { "In progress": inProgressTickets });

    await page.goto("http://localhost:3000/technician/tickets/in-progress");
    await page.getByRole("button", { name: "Reject ticket" }).first().click();
    await expect.poll(() => mock.getLastPatchBody()?.status).toBe("Open");

    await page.getByPlaceholder("Subject, student, technician, category...").fill("no-match-value");
    await expect(page.getByText("No tickets match the selected filters.")).toBeVisible();

    await page.unroute("**/api/admin/support-tickets**");
    await installQueueApiMock(page, { "In progress": [] });
    await page.reload();
    await expect(page.getByText("No in-progress tickets assigned to you.")).toBeVisible();
  });

  test("accepted queue: list, resolve action, reject action and filters", async ({ page }) => {
    await seedTechnicianSession(page);
    const mock = await installQueueApiMock(page, { Accepted: acceptedTickets });

    await page.goto("http://localhost:3000/technician/tickets/accepted");
    await expect(page.getByRole("heading", { name: "My accepted tickets" })).toBeVisible();
    await expect(page.getByText("Showing 2 of 2")).toBeVisible();

    await page.locator("textarea").first().fill("Issue is fully resolved.");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Mark resolved" }).first().click();
    await expect.poll(() => mock.getLastPatchBody()?.status).toBe("Resolved");

    await page.getByRole("button", { name: "Reject ticket" }).first().click();
    await expect.poll(() => mock.getLastPatchBody()?.status).toBe("Open");

    await page.getByPlaceholder("Subject, student, technician, category...").fill("login");
    await expect(page.getByText("Showing 1 of 2")).toBeVisible();
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByText("Showing 2 of 2")).toBeVisible();
  });

  test("accepted queue: empty state", async ({ page }) => {
    await seedTechnicianSession(page);
    await installQueueApiMock(page, { Accepted: [] });

    await page.goto("http://localhost:3000/technician/tickets/accepted");
    await expect(page.getByText("No accepted tickets assigned to you.")).toBeVisible();
  });

  test("resolved queue: list, reopen action, details, refresh and empty state", async ({ page }) => {
    await seedTechnicianSession(page);
    const mock = await installQueueApiMock(page, { Resolved: resolvedTickets });

    await page.goto("http://localhost:3000/technician/tickets/resolved");
    await expect(page.getByRole("heading", { name: "My resolved tickets" })).toBeVisible();
    await expect(page.getByText("Showing 1 of 1")).toBeVisible();

    await page.getByRole("button", { name: "See details" }).first().click();
    await expect(page.getByText("Student ticket details")).toBeVisible();
    await page.getByRole("button", { name: "Hide details" }).first().click();

    await page.getByRole("button", { name: "Back to accepted" }).first().click();
    await expect.poll(() => mock.getLastPatchBody()?.status).toBe("Accepted");

    await page.getByRole("button", { name: "Refresh" }).click();
    await expect.poll(() => mock.getListRequestCount()).toBeGreaterThan(1);

    await page.unroute("**/api/admin/support-tickets**");
    await installQueueApiMock(page, { Resolved: [] });
    await page.reload();
    await expect(page.getByText("No resolved tickets assigned to you yet.")).toBeVisible();
  });
});

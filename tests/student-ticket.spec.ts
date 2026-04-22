import { test, expect } from "@playwright/test";

const ROLE_STORAGE_KEY = "unihub_role";
const USER_STORAGE_KEY = "unihub_user";

/** Seeded so `RoleGuard` allows `/student/*` when not in demo mode (e.g. reusing a plain `next dev` server). */
const e2eStudentUser = {
  id: "507f1f77bcf86cd799439099",
  name: "Playwright Student",
  role: "STUDENT" as const,
  mustChangePassword: false,
};

/** Sample list payload matching `/api/support-tickets` GET and client parsing. */
const mockTicketsPayload = {
  items: [
    {
      id: "507f1f77bcf86cd799439011",
      subject: "Wi-Fi issue in lab",
      category: "Technical",
      subcategory: "Wi-Fi",
      description: "Cannot connect to guest network in lab 3.",
      priority: "High",
      status: "Open",
      contactEmail: "student@example.edu",
      createdAt: "2025-01-15T10:00:00.000Z",
    },
    {
      id: "507f1f77bcf86cd799439012",
      subject: "Fee payment receipt",
      category: "Finance",
      subcategory: "Fees",
      description: "Need a duplicate receipt for the last semester payment.",
      priority: "Low",
      status: "Resolved",
      contactPhone: "1234567890",
      createdAt: "2025-01-10T08:00:00.000Z",
    },
  ],
  total: 2,
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ([roleKey, userKey, userJson]) => {
      window.localStorage.setItem(roleKey, "STUDENT");
      window.localStorage.setItem(userKey, userJson);
    },
    [ROLE_STORAGE_KEY, USER_STORAGE_KEY, JSON.stringify(e2eStudentUser)]
  );

  // Match by `route.request().url()` (pathname) — host may be 127.0.0.1, localhost, [::1], etc.
  await page.route("**/*", async (route) => {
    let pathname = "";
    try {
      pathname = new URL(route.request().url()).pathname;
    } catch {
      await route.continue();
      return;
    }
    if (pathname !== "/api/support-tickets" && pathname !== "/api/support-tickets/") {
      await route.continue();
      return;
    }
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTicketsPayload),
      });
      return;
    }
    if (method === "POST") {
      let body: Record<string, unknown> = {};
      try {
        const raw = route.request().postData();
        if (raw) {
          body = JSON.parse(raw) as Record<string, unknown>;
        }
      } catch {
        body = {};
      }
      const subject = String(body.subject ?? "Ticket");
      const category = String(body.category ?? "Technical");
      const subcategory = String(body.subcategory ?? "Other");
      const description = String(body.description ?? "Description");
      const priority = body.priority === "High" || body.priority === "Low" ? body.priority : "Medium";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "507f1f77bcf86cd7994390ff",
          subject,
          category,
          subcategory,
          description,
          priority,
          status: "Open",
          ...(typeof body.contactEmail === "string" && body.contactEmail
            ? { contactEmail: body.contactEmail }
            : {}),
          ...(typeof body.contactPhone === "string" && body.contactPhone
            ? { contactPhone: body.contactPhone }
            : {}),
          ...(typeof body.contactWhatsapp === "string" && body.contactWhatsapp
            ? { contactWhatsapp: body.contactWhatsapp }
            : {}),
          createdAt: "2025-01-20T12:00:00.000Z",
        }),
      });
      return;
    }
    await route.continue();
  });
});

test("shows the tickets hub and ticket list from the API", async ({ page }) => {
  await page.goto("/student/ticket");

  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await expect(
    page.getByText("Track maintenance and incident requests", { exact: true })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "New Ticket" })).toBeVisible();

  await expect(page.getByRole("heading", { name: "Your Tickets" })).toBeVisible();
  await expect(page.getByText("2 result(s)", { exact: true })).toBeVisible();
  await expect(page.getByText("Wi-Fi issue in lab", { exact: true })).toBeVisible();
  await expect(page.getByText("Fee payment receipt", { exact: true })).toBeVisible();
});

test("search narrows the ticket list", async ({ page }) => {
  await page.goto("/student/ticket");

  await expect(page.getByText("2 result(s)", { exact: true })).toBeVisible();

  const search = page.getByPlaceholder("Title, description, category, or ticket ID");
  await search.fill("Wi-Fi");

  await expect(page.getByText("1 result(s)", { exact: true })).toBeVisible();
  await expect(page.getByText("Wi-Fi issue in lab", { exact: true })).toBeVisible();
  await expect(page.getByText("Fee payment receipt", { exact: true })).not.toBeVisible();
});

test("expands a ticket row to show details", async ({ page }) => {
  await page.goto("/student/ticket");

  const row = page.getByText("Wi-Fi issue in lab", { exact: true });
  const detailsButton = page.getByRole("button", { name: "View Details" }).first();

  await detailsButton.click();
  await expect(
    page.getByText("Cannot connect to guest network in lab 3.", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("ID 507f1f77bcf86cd799439011", { exact: true })).toBeVisible();

  await detailsButton.click();
  await expect(
    page.getByText("Cannot connect to guest network in lab 3.", { exact: true })
  ).not.toBeVisible();
});

test("new ticket form shows required fields and defaults", async ({ page }) => {
  await page.goto("/student/ticket");
  await page.getByRole("button", { name: "New Ticket" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "New ticket" })).toBeVisible();
  await expect(
    dialog.getByText("Describe the issue so staff can help.", { exact: true })
  ).toBeVisible();

  await expect(dialog.getByPlaceholder("Short summary")).toBeVisible();
  await expect(dialog.locator("#modal-ticket-category")).toHaveValue("");
  await expect(dialog.locator("#modal-ticket-subcategory")).toBeDisabled();
  await expect(
    dialog.locator("#modal-ticket-subcategory option:checked")
  ).toHaveText("Select category first");
  await expect(dialog.getByPlaceholder("What happened, and what do you need?")).toBeVisible();
  await expect(dialog.getByText("0 characters", { exact: true })).toBeVisible();

  await expect(dialog.getByRole("checkbox", { name: "Email" })).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: "Phone Number" })).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: "WhatsApp Number" })).toBeVisible();

  await expect(dialog.getByRole("radio", { name: "Medium" })).toBeChecked();

  const modalForm = dialog.locator("form");
  await modalForm.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(dialog.getByText(/Contact information/)).toBeVisible();
  await expect(dialog.getByText("Evidence (optional)", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("new ticket form shows validation when required fields are empty", async ({ page }) => {
  await page.goto("/student/ticket");
  await page.getByRole("button", { name: "New Ticket" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Create ticket" })).toBeVisible();
  await dialog.getByRole("button", { name: "Create ticket" }).click();

  await expect(dialog.getByText("Title is required.", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Please select a category.", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Please select a subcategory.", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Description is required.", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText("Select at least one contact option (email, phone, or WhatsApp).", {
      exact: true,
    })
  ).toBeVisible();
});

test("new ticket form submits a valid ticket and shows success", async ({ page }) => {
  await page.goto("/student/ticket");
  await page.getByRole("button", { name: "New Ticket" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Short summary").fill("Classroom projector not working");
  await dialog.locator("#modal-ticket-category").selectOption("Technical");
  await dialog.locator("#modal-ticket-subcategory").selectOption("Login");
  await dialog
    .getByPlaceholder("What happened, and what do you need?")
    .fill(
      "The projector in hall B will not power on. Please send someone to check the power cable and lamp."
    );
  await dialog.getByRole("checkbox", { name: "Email" }).check();
  await dialog.getByPlaceholder("Email address").fill("student@example.edu");
  await dialog.getByRole("radio", { name: "High" }).check();
  await dialog.getByRole("button", { name: "Create ticket" }).click();

  await expect(page.getByText("Ticket created", { exact: true })).toBeVisible();
  await expect(page.getByText("Your request and evidence were saved.", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

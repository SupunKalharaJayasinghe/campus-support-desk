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

async function seedTechnicianSession(page: Page) {
  await page.addInitScript(
    ([roleKey, userKey, userJson]) => {
      window.localStorage.setItem(roleKey, "TECHNICIAN");
      window.localStorage.setItem(userKey, userJson);
    },
    [ROLE_STORAGE_KEY, USER_STORAGE_KEY, JSON.stringify(technicianUser)]
  );
}

test.describe("technician dashboard page", () => {
  test("shows queue cards, totals and links", async ({ page }) => {
    await seedTechnicianSession(page);

    await page.route("**/api/admin/support-tickets**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("mine") !== "1") {
        await route.fallback();
        return;
      }
      const status = url.searchParams.get("status");
      const total =
        status === "In progress" ? 2 : status === "Accepted" ? 3 : status === "Resolved" ? 1 : 0;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ total }),
      });
    });

    await page.goto("http://localhost:3000/technician");

    await expect(page.getByRole("heading", { name: "Hello, Playwright Technician" })).toBeVisible();
    await expect(page.getByText("Technician Portal", { exact: true })).toBeVisible();
    await expect(page.getByText("play.tech@example.edu", { exact: true })).toBeVisible();

    await expect(page.getByText("In progress", { exact: true })).toBeVisible();
    await expect(page.getByText("Accepted", { exact: true })).toBeVisible();
    await expect(page.getByText("Resolved", { exact: true })).toBeVisible();

    await expect(page.getByText("2", { exact: true })).toBeVisible();
    await expect(page.getByText("3", { exact: true })).toBeVisible();
    await expect(page.getByText("1", { exact: true })).toBeVisible();

    await expect(page.getByRole("link", { name: "View list" }).nth(0)).toHaveAttribute(
      "href",
      "/technician/tickets/in-progress"
    );
    await expect(page.getByRole("link", { name: "View list" }).nth(1)).toHaveAttribute(
      "href",
      "/technician/tickets/accepted"
    );
    await expect(page.getByRole("link", { name: "View list" }).nth(2)).toHaveAttribute(
      "href",
      "/technician/tickets/resolved"
    );

    await expect(page.getByText("6 support tickets visible in your current queues.")).toBeVisible();
  });

  test("shows zero total when API returns no totals", async ({ page }) => {
    await seedTechnicianSession(page);

    await page.route("**/api/admin/support-tickets**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("mine") !== "1") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.goto("http://localhost:3000/technician");
    await expect(page.getByText("0 support tickets visible in your current queues.")).toBeVisible();
  });

  test("shows API error message when one status request fails", async ({ page }) => {
    await seedTechnicianSession(page);

    await page.route("**/api/admin/support-tickets**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("mine") !== "1") {
        await route.fallback();
        return;
      }
      const status = url.searchParams.get("status");
      if (status === "Accepted") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Failed to load accepted tickets" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ total: 1 }),
      });
    });

    await page.goto("http://localhost:3000/technician");
    await expect(page.getByText("Failed to load accepted tickets", { exact: true })).toBeVisible();
  });
});

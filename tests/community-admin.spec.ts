import { expect, test, type Page } from "@playwright/test";

test.setTimeout(120_000);

const ROLE_STORAGE_KEY = "unihub_role";
const USER_STORAGE_KEY = "unihub_user";
const PAYMENT_DONE_KEY = "communityUrgentCardPaymentDoneAck";

const communityAdminUser = {
  id: "507f1f77bcf86cd799439091",
  name: "Playwright Community Admin",
  role: "COMMUNITY_ADMIN" as const,
  userRole: "COMMUNITY_ADMIN",
  username: "community.admin",
  email: "community.admin@example.edu",
  mustChangePassword: false,
};

type MockMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
  contributions: number;
  communityProfilePoints: number;
  adminBonus20Used: boolean;
  status: "Active" | "Warned" | "Suspended";
  hasCommunityProfile: boolean;
};

type MockReport = {
  _id: string;
  postId: {
    _id: string;
    title: string;
    description: string;
    category: "academic_question" | "study_material" | "lost_item";
    authorDisplayName: string;
  };
  userId: {
    username: string;
    email: string;
  };
  reason: string;
  reasonKey: "harassment" | "misinformation" | "inappropriate" | "other";
  details?: string;
  status: "OPEN" | "REVIEWED" | "AGREED" | "DISMISSED";
  adminReviewAcknowledged?: boolean;
  reviewComment?: string;
  createdAt: string;
  updatedAt: string;
};

const todayIso = new Date().toISOString();

const baseReports: MockReport[] = [
  {
    _id: "r-open-1",
    postId: {
      _id: "507f1f77bcf86cd7994390a1",
      title: "Open: Offensive message in group",
      description: "A post allegedly contains offensive language.",
      category: "academic_question",
      authorDisplayName: "Student Author A",
    },
    userId: { username: "reporter.one", email: "reporter.one@example.edu" },
    reason: "Potential harassment in comments",
    reasonKey: "harassment",
    details: "Contains direct insults.",
    status: "OPEN",
    createdAt: "2026-04-22T08:00:00.000Z",
    updatedAt: "2026-04-22T08:00:00.000Z",
  },
  {
    _id: "r-reviewed-1",
    postId: {
      _id: "507f1f77bcf86cd7994390a2",
      title: "Reviewed: Need fact check",
      description: "Claims about exam policy look inaccurate.",
      category: "study_material",
      authorDisplayName: "Student Author B",
    },
    userId: { username: "reporter.two", email: "reporter.two@example.edu" },
    reason: "May be misinformation",
    reasonKey: "misinformation",
    status: "REVIEWED",
    adminReviewAcknowledged: true,
    reviewComment: "Initial review saved.",
    createdAt: "2026-04-21T08:00:00.000Z",
    updatedAt: "2026-04-21T10:00:00.000Z",
  },
  {
    _id: "r-agreed-1",
    postId: {
      _id: "507f1f77bcf86cd7994390a3",
      title: "Confirmed: Inappropriate media",
      description: "Contains disallowed attachment.",
      category: "lost_item",
      authorDisplayName: "Student Author C",
    },
    userId: { username: "reporter.three", email: "reporter.three@example.edu" },
    reason: "Inappropriate content shared",
    reasonKey: "inappropriate",
    status: "AGREED",
    adminReviewAcknowledged: true,
    reviewComment: "Confirmed against policy.",
    createdAt: "2026-04-20T08:00:00.000Z",
    updatedAt: todayIso,
  },
  {
    _id: "r-dismissed-1",
    postId: {
      _id: "507f1f77bcf86cd7994390a4",
      title: "Dismissed: Duplicate report",
      description: "Already handled in prior report.",
      category: "study_material",
      authorDisplayName: "Student Author D",
    },
    userId: { username: "reporter.four", email: "reporter.four@example.edu" },
    reason: "Duplicate/incorrect report",
    reasonKey: "other",
    status: "DISMISSED",
    adminReviewAcknowledged: true,
    reviewComment: "Duplicate issue; no action needed.",
    createdAt: "2026-04-20T09:00:00.000Z",
    updatedAt: todayIso,
  },
];

const baseMembers: MockMember[] = [
  {
    id: "student-alpha",
    userId: "507f1f77bcf86cd7994390b1",
    name: "Member Alpha",
    email: "alpha@example.edu",
    joinedAt: "2026-01-15",
    contributions: 12,
    communityProfilePoints: 30,
    adminBonus20Used: false,
    status: "Active",
    hasCommunityProfile: true,
  },
  {
    id: "student-beta",
    userId: "507f1f77bcf86cd7994390b2",
    name: "Member Beta",
    email: "beta@example.edu",
    joinedAt: "2026-02-02",
    contributions: 4,
    communityProfilePoints: 0,
    adminBonus20Used: false,
    status: "Warned",
    hasCommunityProfile: false,
  },
  {
    id: "student-gamma",
    userId: "507f1f77bcf86cd7994390b3",
    name: "Member Gamma",
    email: "gamma@example.edu",
    joinedAt: "2026-02-15",
    contributions: 2,
    communityProfilePoints: 14,
    adminBonus20Used: true,
    status: "Suspended",
    hasCommunityProfile: true,
  },
];

async function seedCommunityAdminSession(page: Page) {
  await page.addInitScript(
    ([roleKey, userKey, userJson]) => {
      window.localStorage.setItem(roleKey, "COMMUNITY_ADMIN");
      window.localStorage.setItem(userKey, userJson);
    },
    [ROLE_STORAGE_KEY, USER_STORAGE_KEY, JSON.stringify(communityAdminUser)]
  );
}

async function installCommunityAdminApiMock(page: Page) {
  const reports = baseReports.map((item) => ({ ...item, postId: { ...item.postId }, userId: { ...item.userId } }));
  const members = baseMembers.map((item) => ({ ...item }));
  let deletedPostCount = 0;

  await page.route("**/api/community-post-reports", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(reports),
    });
  });

  await page.route("**/api/community-post-reports/*", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }
    const id = route.request().url().split("/").pop() ?? "";
    const idx = reports.findIndex((r) => r._id === id);
    if (idx === -1) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Report not found" }),
      });
      return;
    }
    const body = (route.request().postDataJSON() ?? {}) as {
      status?: "OPEN" | "REVIEWED" | "AGREED" | "DISMISSED";
      saveAdminReview?: boolean;
      adminReviewAcknowledged?: boolean;
      reviewComment?: string;
    };
    const nextStatus =
      body.status ?? (body.saveAdminReview && reports[idx].status === "OPEN" ? "REVIEWED" : reports[idx].status);
    reports[idx] = {
      ...reports[idx],
      status: nextStatus,
      adminReviewAcknowledged: Boolean(body.adminReviewAcknowledged),
      reviewComment: String(body.reviewComment ?? "").trim(),
      updatedAt: new Date().toISOString(),
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(reports[idx]),
    });
  });

  await page.route("**/api/community-posts/*", async (route) => {
    if (route.request().method() !== "DELETE") {
      await route.fallback();
      return;
    }
    const postId = route.request().url().split("/").pop() ?? "";
    const before = reports.length;
    for (let i = reports.length - 1; i >= 0; i -= 1) {
      if (reports[i].postId._id === postId) reports.splice(i, 1);
    }
    if (reports.length < before) deletedPostCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, ownerEmailNotified: true }),
    });
  });

  await page.route("**/api/community-members", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: members }),
    });
  });

  await page.route("**/api/community-profile/admin-points", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    const body = (route.request().postDataJSON() ?? {}) as { userId?: string };
    const member = members.find((m) => m.userId === body.userId);
    if (!member) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "Member not found" }),
      });
      return;
    }
    if (!member.adminBonus20Used) {
      member.communityProfilePoints += 20;
      member.adminBonus20Used = true;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "20 points added" }),
    });
  });

  await page.route("**/api/community-profile**", async (route) => {
    const method = route.request().method();
    if (method === "PUT") {
      const body = (route.request().postDataJSON() ?? {}) as { userId?: string };
      const member = members.find((m) => m.userId === body.userId);
      if (member) member.hasCommunityProfile = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Profile created" }),
      });
      return;
    }
    if (method === "DELETE") {
      const url = new URL(route.request().url());
      const userId = String(url.searchParams.get("userId") ?? "");
      const member = members.find((m) => m.userId === userId);
      if (member) {
        member.hasCommunityProfile = false;
        member.communityProfilePoints = 0;
        member.adminBonus20Used = false;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Removed" }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route("**/api/community-urgent-card-payments**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    const url = new URL(route.request().url());
    const decrypt = url.searchParams.get("decrypt") === "1";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        decryptionAvailable: true,
        items: [
          {
            id: "pay-1",
            userRef: "507f1f77bcf86cd7994390b1",
            status: "PAID",
            amountRs: 500,
            urgentLevel: "2days",
            userUsername: "alpha.user",
            userEmail: "alpha@example.edu",
            displayName: "Member Alpha",
            cardMaskedDisplay: "**** **** **** 1234",
            cardLast4: "1234",
            expiryMonth: 12,
            expiryYear: 2028,
            cvcVerified: true,
            cvcLength: 3,
            panStoredEncrypted: true,
            cardNumberDecrypted: decrypt ? "4111111111111234" : null,
            draftRef: null,
            postRef: "507f1f77bcf86cd7994390a1",
            createdAt: "2026-04-23T08:15:00.000Z",
          },
        ],
      }),
    });
  });

  return {
    getDeletedPostCount: () => deletedPostCount,
  };
}

test.describe("community admin area", () => {
  test("dashboard loads member/report stats and overview links", async ({ page }) => {
    await seedCommunityAdminSession(page);
    await installCommunityAdminApiMock(page);
    await page.goto("http://localhost:3000/community-admin");

    await expect(page.getByRole("heading", { name: "Community Admin" })).toBeVisible();
    await expect(page.getByText("Total members").first()).toBeVisible();
    await expect(page.getByText("Active (1)", { exact: true })).toBeVisible();
    await expect(page.getByText("Warned (1)", { exact: true })).toBeVisible();
    await expect(page.getByText("Suspended (1)", { exact: true })).toBeVisible();
    await expect(page.getByText("Reported posts").first()).toBeVisible();
    await expect(page.getByText("Open reports").first()).toBeVisible();
    await expect(page.getByText("Closed today").first()).toBeVisible();

    await expect(page.getByRole("link", { name: "Open member directory" })).toHaveAttribute(
      "href",
      "/community-admin/members"
    );
    await expect(page.getByRole("link", { name: "Open reported posts" })).toHaveAttribute(
      "href",
      "/community-admin/reported-posts"
    );
  });

  test("report queue supports review, accept, dismiss, and agreed-post delete", async ({ page }) => {
    await seedCommunityAdminSession(page);
    const mock = await installCommunityAdminApiMock(page);
    await page.goto("http://localhost:3000/community-admin/reported-posts");

    await page.getByRole("button", { name: "Check post" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save admin review" })).toBeDisabled();
    await page.getByLabel("As community admin I review this post").check();
    await page.getByLabel("Admin review comment").fill("Checked report evidence carefully.");
    await page.getByRole("button", { name: "Save admin review" }).click();

    await page.waitForURL("**/community-admin/reported-posts/reviewed");
    await expect(page.getByRole("heading", { level: 1, name: "Reviewed report posts" })).toBeVisible();

    await page.getByRole("link", { name: "Open in queue" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("As community admin I confirm this review and any decision I apply").check();
    await page.getByLabel("Admin review comment").fill("Accepting after moderation checks.");
    await page.getByRole("button", { name: "Accept" }).click();

    await page.waitForURL("**/community-admin/reported-posts/confirmed");
    await expect(page.getByRole("heading", { level: 1, name: "Report confirmed posts" })).toBeVisible();

    await page.getByRole("link", { name: "Open in queue" }).first().click();
    await page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete post" }).click();
    await expect.poll(() => mock.getDeletedPostCount()).toBeGreaterThan(0);

    await page.goto("http://localhost:3000/community-admin/reported-posts/reviewed");
    await page.getByRole("link", { name: "Open in queue" }).first().click();
    await page.getByLabel("As community admin I confirm this review and any decision I apply").check();
    await page.getByLabel("Admin review comment").fill("Dismissing due to weak evidence.");
    await page.getByRole("button", { name: "Dismiss" }).click();
    await page.waitForURL("**/community-admin/reported-posts/dismissed");
    await expect(page.getByRole("heading", { level: 1, name: "Report dismissed posts" })).toBeVisible();
  });

  test("filters page can narrow reports and open matching report in queue", async ({ page }) => {
    await seedCommunityAdminSession(page);
    await installCommunityAdminApiMock(page);
    await page.goto("http://localhost:3000/community-admin/reported-posts/filters");

    await expect(page.getByRole("heading", { name: "Filters & search" })).toBeVisible();
    await page.locator("select").first().selectOption("study_material");
    await page.locator("select").nth(1).selectOption("Medium");
    await page.getByLabel("Search").fill("fact check");
    await expect(page.getByText("Reviewed: Need fact check")).toBeVisible();

    await page.getByRole("checkbox", { name: /Open/i }).uncheck();
    await page.getByRole("checkbox", { name: /Reviewed/i }).uncheck();
    await page.getByRole("checkbox", { name: /Agreed/i }).uncheck();
    await page.getByRole("checkbox", { name: /Dismissed/i }).uncheck();
    await expect(page.getByText("Turn on at least one status above to see matches.")).toBeVisible();

    await page.getByRole("button", { name: "Reset filters" }).click();
    await page.getByRole("link", { name: "Open in queue" }).first().click();
    await page.waitForURL("**/community-admin/reported-posts");
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("members page supports search, add profile, points bonus, and remove profile", async ({ page }) => {
    await seedCommunityAdminSession(page);
    await installCommunityAdminApiMock(page);
    await page.goto("http://localhost:3000/community-admin/members");

    await expect(page.getByRole("heading", { name: "Community members" })).toBeVisible();
    await page.getByPlaceholder("Search by username, email, or user ID").fill("beta");
    await expect(page.getByText("Member Beta")).toBeVisible();

    await page.getByRole("button", { name: "Add to community" }).click();
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("button", { name: "Add to community" })).not.toBeVisible();

    await page.getByRole("button", { name: "+20 points" }).first().click();
    await expect(page.getByText("20 points added")).toBeVisible();
    await expect(page.getByText("+20 used").first()).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).first().click();
    await page.getByLabel("Confirmation").fill("Delete");
    await page.getByRole("button", { name: "OK" }).click();
    await expect(page.getByText("Removed from community.")).toBeVisible();
  });

  test("urgent payments page shows records, payment done modal, and search/toggle", async ({ page }) => {
    await seedCommunityAdminSession(page);
    await installCommunityAdminApiMock(page);
    await page.addInitScript(([key]) => {
      window.sessionStorage.setItem(key, "1");
    }, [PAYMENT_DONE_KEY]);
    await page.goto("http://localhost:3000/community-admin/urgent-payments?paymentDone=1");

    await expect(page.getByRole("heading", { name: "Urgent card payments" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Payment complete" })).toBeVisible();
    await page.getByRole("button", { name: "OK" }).click();
    await expect(page.getByRole("dialog", { name: "Payment complete" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Show decrypted PAN" })).toBeVisible();
    await page.getByRole("button", { name: "Show decrypted PAN" }).click();
    await expect(page.getByText(/PAN:/)).toBeVisible();

    await page.getByLabel("Search payment records").fill("alpha@example.edu");
    await expect(page.getByText("1 of 1 shown")).toBeVisible();
    await page.getByLabel("Search payment records").fill("missing-user");
    await expect(page.getByText("No records match your search.")).toBeVisible();

    await expect(page.getByText("No records match your search.")).toBeVisible();
  });
});

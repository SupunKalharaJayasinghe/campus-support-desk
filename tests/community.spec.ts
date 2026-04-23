import { expect, test, type Page } from "@playwright/test";
test.setTimeout(60_000);

const ROLE_STORAGE_KEY = "unihub_role";
const USER_STORAGE_KEY = "unihub_user";

const studentUser = {
  id: "507f1f77bcf86cd799439031",
  name: "Playwright Student",
  role: "STUDENT" as const,
  userRole: "STUDENT",
  username: "play.student",
  email: "play.student@example.edu",
  mustChangePassword: false,
};

const apiPosts = [
  {
    _id: "p1",
    title: "Lost calculator near lab 2",
    description: "Black Casio calculator found near the CS lab entrance.",
    category: "lost_item",
    createdAt: "2026-04-23T08:00:00.000Z",
    authorDisplayName: "Nimal",
    likesCount: 3,
    likedByCurrentUser: false,
    reportedByCurrentUser: false,
    isUrgent: true,
    urgentLevel: "2days",
    urgentExpiresAt: "2030-01-01T00:00:00.000Z",
  },
  {
    _id: "p2",
    title: "Next.js notes for exams",
    description: "Sharing revision slides and short notes.",
    category: "study_material",
    createdAt: "2026-04-23T07:00:00.000Z",
    authorDisplayName: "Sana",
    likesCount: 5,
    likedByCurrentUser: false,
    reportedByCurrentUser: false,
    isUrgent: false,
    urgentLevel: null,
    urgentExpiresAt: null,
  },
  {
    _id: "p3",
    title: "How to prepare for DBMS viva?",
    description: "Any tips for answering schema design questions?",
    category: "academic_question",
    createdAt: "2026-04-22T10:00:00.000Z",
    authorDisplayName: "Akila",
    likesCount: 1,
    likedByCurrentUser: false,
    reportedByCurrentUser: false,
    isUrgent: false,
    urgentLevel: null,
    urgentExpiresAt: null,
  },
];

const repliesByPostId: Record<string, Array<Record<string, unknown>>> = {
  p1: [
    {
      _id: "r1",
      postId: "p1",
      message: "Please hand it over to security office.",
      authorDisplayName: "Yasith",
      createdAt: "2026-04-23T08:30:00.000Z",
      likesCount: 0,
      likedByCurrentUser: false,
    },
  ],
  p2: [],
  p3: [],
};

async function seedStudentSession(page: Page) {
  await page.addInitScript(
    ([roleKey, userKey, userJson]) => {
      window.localStorage.setItem(roleKey, "STUDENT");
      window.localStorage.setItem(userKey, userJson);
    },
    [ROLE_STORAGE_KEY, USER_STORAGE_KEY, JSON.stringify(studentUser)]
  );
}

type MockOptions = {
  postsPayload?: unknown[];
  failPostLike?: boolean;
  failReplyLike?: boolean;
  failReplyCreate?: boolean;
  failReport?: boolean;
  failPostsGet?: boolean;
};

async function installCommunityApiMock(page: Page, options: MockOptions = {}) {
  let postLikeCount = 0;
  let replyLikeCount = 0;
  let reportCount = 0;
  let replyCreateCount = 0;
  let lastReportReason = "";
  let lastReplyMessage = "";

  await page.route("**/api/community-posts**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    if (options.failPostsGet) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Failed to load posts" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(options.postsPayload ?? apiPosts),
    });
  });

  await page.route("**/api/community-replies**", async (route) => {
    const method = route.request().method();

    if (method === "GET") {
      const url = new URL(route.request().url());
      const postId = String(url.searchParams.get("postId") ?? "");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(repliesByPostId[postId] ?? []),
      });
      return;
    }

    if (method === "POST") {
      const body = (route.request().postDataJSON() ?? {}) as {
        postId?: string;
        message?: string;
      };
      replyCreateCount += 1;
      lastReplyMessage = String(body.message ?? "");
      if (options.failReplyCreate) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Reply failed" }),
        });
        return;
      }
      const created = {
        _id: "r-created-1",
        postId: String(body.postId ?? "p1"),
        message: String(body.message ?? ""),
        authorDisplayName: "Playwright Student",
        createdAt: "2026-04-23T09:00:00.000Z",
        likesCount: 0,
        likedByCurrentUser: false,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/community-members**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            userId: "s1",
            hasCommunityProfile: true,
            communityProfileDisplayName: "Member One",
            communityProfilePoints: 120,
            communityProfileAvatarUrl: "",
            name: "Member One",
          },
        ],
      }),
    });
  });

  await page.route("**/api/community-profile**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ avatarUrl: "" }),
    });
  });

  await page.route("**/api/community-post-likes", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    postLikeCount += 1;
    if (options.failPostLike) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Failed to update post like." }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ liked: true, likesCount: 4 }),
    });
  });

  await page.route("**/api/community-reply-likes", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    replyLikeCount += 1;
    if (options.failReplyLike) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Failed to update reply like." }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ liked: true, likesCount: 1 }),
    });
  });

  await page.route("**/api/community-post-reports", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    reportCount += 1;
    const body = (route.request().postDataJSON() ?? {}) as {
      reasonKey?: string;
    };
    lastReportReason = String(body.reasonKey ?? "");
    if (options.failReport) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Failed to report post." }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  return {
    getPostLikeCount: () => postLikeCount,
    getReplyLikeCount: () => replyLikeCount,
    getReportCount: () => reportCount,
    getReplyCreateCount: () => replyCreateCount,
    getLastReportReason: () => lastReportReason,
    getLastReplyMessage: () => lastReplyMessage,
  };
}

test.describe("community page", () => {
  test("loads feed, category filters, title search, and right panel blocks", async ({
    page,
  }) => {
    await seedStudentSession(page);
    await installCommunityApiMock(page);
    await page.goto("http://localhost:3000/community");

    await expect(page.getByText("Community", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "🔥 Urgent" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Lost calculator near lab 2" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Next.js notes for exams" })
    ).toBeVisible();

    await page.getByRole("tab", { name: "📂 Study Materials" }).click();
    await expect(
      page.getByRole("heading", { name: "Next.js notes for exams" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Lost calculator near lab 2" })
    ).not.toBeVisible();

    await page.getByRole("tab", { name: "All" }).click();
    await page
      .getByPlaceholder("Search community post's title")
      .fill("DBMS viva");
    await expect(
      page.getByRole("heading", { name: "How to prepare for DBMS viva?" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Lost calculator near lab 2" })
    ).not.toBeVisible();

    await expect(
      page.getByLabel("Urgent posts and community instructions")
    ).toBeVisible();
    await expect(
      page.getByText("Community instructions", { exact: true })
    ).toBeVisible();
  });

  test("supports liking posts/replies, sending reply, and reporting", async ({
    page,
  }) => {
    await seedStudentSession(page);
    const mock = await installCommunityApiMock(page);
    await page.goto("http://localhost:3000/community");

    await page
      .locator(".ui-card")
      .filter({ hasText: "Lost calculator near lab 2" })
      .getByRole("button", { name: "Reply" })
      .click();

    await expect(
      page.getByText("Please hand it over to security office.", { exact: true })
    ).toBeVisible();

    await page
      .locator(".ui-card")
      .filter({ hasText: "Lost calculator near lab 2" })
      .getByRole("button", { name: "3" })
      .click();
    await expect.poll(() => mock.getPostLikeCount()).toBeGreaterThan(0);

    await page
      .locator(".ui-card")
      .filter({ hasText: "Please hand it over to security office." })
      .getByRole("button", { name: "0" })
      .click();
    await expect.poll(() => mock.getReplyLikeCount()).toBeGreaterThan(0);

    const targetCard = page
      .locator(".ui-card")
      .filter({ hasText: "Lost calculator near lab 2" })
      .first();
    await targetCard
      .getByPlaceholder("Write a reply… (optional if you attach a file)")
      .fill("Thanks, I will hand it over.");
    await targetCard.locator("form").getByRole("button", { name: "Reply" }).click();
    await expect.poll(() => mock.getReplyCreateCount()).toBeGreaterThan(0);
    await expect
      .poll(() => mock.getLastReplyMessage())
      .toContain("Thanks, I will hand it over.");
    await expect(
      page.getByText("Thanks, I will hand it over.", { exact: true })
    ).toBeVisible();

    await page
      .locator(".ui-card")
      .filter({ hasText: "Lost calculator near lab 2" })
      .getByRole("button", { name: "Report" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Report this post" })
    ).toBeVisible();
    await page.getByLabel("False or harmful information").check();
    await page.getByRole("button", { name: "Submit report" }).click();
    await expect.poll(() => mock.getReportCount()).toBeGreaterThan(0);
    await expect.poll(() => mock.getLastReportReason()).toBe("misinformation");
    await expect(
      page
        .locator(".ui-card")
        .filter({ hasText: "Lost calculator near lab 2" })
        .getByRole("button", { name: "Reported" })
    ).toBeVisible();
  });

  test("opens sidebar member/recent sections and profile menu links", async ({
    page,
  }) => {
    await seedStudentSession(page);
    await installCommunityApiMock(page);
    await page.goto("http://localhost:3000/community");

    await page.getByRole("button", { name: "Members Details" }).click();
    await expect(page.getByText("Member One", { exact: true })).toBeVisible();
    await expect(page.getByText("120 pts", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Recent Posts" }).click();
    await expect(
      page.getByRole("button", { name: /Lost calculator near lab 2/i })
    ).toBeVisible();

    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(
      page.locator("header").getByRole("link", { name: "Profile" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Settings/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Back to student page" }).first()
    ).toBeVisible();
  });

  test("empty posts payload shows no matching state", async ({ page }) => {
    await seedStudentSession(page);
    await installCommunityApiMock(page, { postsPayload: [] });
    await page.goto("http://localhost:3000/community");

    await expect(page.getByText("No matching posts found.", { exact: true })).toBeVisible();
  });

  test("fallback posts remain visible when posts API fails", async ({ page }) => {
    await seedStudentSession(page);
    await installCommunityApiMock(page, { failPostsGet: true });
    await page.goto("http://localhost:3000/community");

    await expect(
      page.getByRole("heading", { name: "Best resources for learning Next.js 14?" })
    ).toBeVisible();
  });

  test("shows errors for failed post like, reply like, reply submit, and report", async ({
    page,
  }) => {
    await seedStudentSession(page);
    await installCommunityApiMock(page, {
      failPostLike: true,
      failReplyLike: true,
      failReplyCreate: true,
      failReport: true,
    });
    await page.goto("http://localhost:3000/community");

    const targetCard = page
      .locator(".ui-card")
      .filter({ hasText: "Lost calculator near lab 2" })
      .first();

    await targetCard.getByRole("button", { name: "Reply" }).click();

    await targetCard.getByRole("button", { name: "3" }).click();
    await expect(page.getByText("Failed to update post like.", { exact: true })).toBeVisible();

    await targetCard
      .locator(".rounded-xl")
      .filter({ hasText: "Please hand it over to security office." })
      .getByRole("button", { name: "0" })
      .click();
    await expect(page.getByText("Failed to update reply like.", { exact: true })).toBeVisible();

    await targetCard
      .getByPlaceholder("Write a reply… (optional if you attach a file)")
      .fill("this should fail");
    await targetCard.locator("form").getByRole("button", { name: "Reply" }).click();
    await expect(page.getByText("Reply failed", { exact: true })).toBeVisible();

    await targetCard.getByRole("button", { name: "Report" }).click();
    await page.getByRole("button", { name: "Submit report" }).click();
    await expect(page.getByText("Failed to report post.", { exact: true })).toBeVisible();
  });

  test("validates report dialog for Other reason details", async ({ page }) => {
    await seedStudentSession(page);
    await installCommunityApiMock(page);
    await page.goto("http://localhost:3000/community");

    const targetCard = page
      .locator(".ui-card")
      .filter({ hasText: "Lost calculator near lab 2" })
      .first();
    await targetCard.getByRole("button", { name: "Report" }).click();
    await page.getByLabel("Other").check();
    await page.getByRole("button", { name: "Submit report" }).click();
    await expect(page.getByText("Please describe what is wrong.", { exact: true })).toBeVisible();
  });

  test("rejects oversized reply attachment", async ({ page }) => {
    await seedStudentSession(page);
    await installCommunityApiMock(page);
    await page.goto("http://localhost:3000/community");

    const targetCard = page
      .locator(".ui-card")
      .filter({ hasText: "Lost calculator near lab 2" })
      .first();
    await targetCard.getByRole("button", { name: "Reply" }).click();

    const fileInput = targetCard.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "too-large.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("a".repeat(1_900_000)),
    });
    await expect(
      page.getByText("Attachment is too large (max ~1.8 MB).", { exact: true })
    ).toBeVisible();
  });

  test("mobile view supports sidebar toggle and category chips", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedStudentSession(page);
    await installCommunityApiMock(page);
    await page.goto("http://localhost:3000/community");

    await expect(page.getByRole("button", { name: "Toggle sidebar" })).toBeVisible();
    await page.getByRole("button", { name: "Toggle sidebar" }).click();

    await page.getByRole("tab", { name: "📘 Academic" }).click();
    await expect(
      page.getByRole("heading", { name: "How to prepare for DBMS viva?" })
    ).toBeVisible();
  });

  test("header menu and create navigation routes are reachable", async ({ page }) => {
    await seedStudentSession(page);
    await installCommunityApiMock(page);
    await page.goto("http://localhost:3000/community");

    await expect(page.getByRole("link", { name: "Create" })).toHaveAttribute(
      "href",
      "/community/profile#create-post"
    );

    await page.goto("http://localhost:3000/community");
    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(
      page.locator("header").getByRole("link", { name: "Profile" })
    ).toHaveAttribute("href", "/community/profile");

    await page.goto("http://localhost:3000/community");
    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/community/Settings"
    );
  });
});

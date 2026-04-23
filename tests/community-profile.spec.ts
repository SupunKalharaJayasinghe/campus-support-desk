import { expect, test, type Page } from "@playwright/test";
test.setTimeout(100_000);

const ROLE_STORAGE_KEY = "unihub_role";
const USER_STORAGE_KEY = "unihub_user";

const studentUser = {
  id: "507f1f77bcf86cd799439051",
  name: "Profile Test Student",
  role: "STUDENT" as const,
  userRole: "STUDENT",
  username: "profile.student",
  email: "profile.student@example.edu",
  mustChangePassword: false,
};

const basePosts = [
  {
    _id: "open-1",
    title: "Open post from profile",
    description: "Need help with assignment question 4.",
    category: "academic_question",
    status: "open",
    createdAt: "2026-04-23T10:00:00.000Z",
    likesCount: 4,
    repliesCount: 1,
    replies: [
      {
        _id: "reply-1",
        postId: "open-1",
        authorDisplayName: "Mentor User",
        message: "Start by drawing the ER diagram first.",
        createdAt: "2026-04-23T10:10:00.000Z",
        isAccepted: false,
      },
    ],
  },
  {
    _id: "resolved-1",
    title: "Resolved profile post",
    description: "Issue fixed, sharing final answer.",
    category: "study_material",
    status: "resolved",
    createdAt: "2026-04-22T10:00:00.000Z",
    likesCount: 2,
    repliesCount: 1,
    replies: [
      {
        _id: "reply-2",
        postId: "resolved-1",
        authorDisplayName: "Community User",
        message: "Great explanation.",
        createdAt: "2026-04-22T10:20:00.000Z",
        isAccepted: false,
      },
    ],
  },
  {
    _id: "archived-1",
    title: "Archived profile post",
    description: "Older thread to keep for reference.",
    category: "lost_item",
    status: "open",
    createdAt: "2026-03-01T10:00:00.000Z",
    likesCount: 1,
    repliesCount: 0,
    replies: [],
  },
];

const baseDrafts = [
  {
    id: "draft-1",
    userId: studentUser.id,
    title: "Draft from profile",
    description: "Draft content for posting.",
    category: "study_material",
    tags: ["notes"],
    attachments: [],
    pictureUrl: "",
    status: "open",
    isUrgent: false,
    urgentLevel: null,
    urgentPaymentMethod: null,
    urgentPrepayId: null,
    urgentCardLast4: null,
    urgentCardPaymentRecordId: null,
    createdAt: "2026-04-23T09:00:00.000Z",
    updatedAt: "2026-04-23T09:10:00.000Z",
  },
];

type MockOptions = {
  posts?: Array<Record<string, unknown>>;
  drafts?: Array<Record<string, unknown>>;
  failLoadPosts?: boolean;
  failLoadDrafts?: boolean;
  failResolve?: boolean;
  failAccept?: boolean;
  failDeletePost?: boolean;
  failDeleteDraft?: boolean;
  failPostDraft?: boolean;
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

async function installProfileApiMock(page: Page, options: MockOptions = {}) {
  let resolveCount = 0;
  let acceptCount = 0;
  let deletePostCount = 0;
  let deleteDraftCount = 0;
  let postDraftCount = 0;

  await page.route("**/api/community-profile**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        displayName: "Profile Test Student",
        username: "profile.student",
        email: "profile.student@example.edu",
        bio: "Testing the profile page thoroughly.",
        points: 24,
        repliesCount: 9,
      }),
    });
  });

  await page.route("**/api/community-user-posts**", async (route) => {
    if (options.failLoadPosts) {
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
      body: JSON.stringify(options.posts ?? basePosts),
    });
  });

  await page.route("**/api/community-drafts**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    if (options.failLoadDrafts) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Failed to load drafts" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(options.drafts ?? baseDrafts),
    });
  });

  await page.route("**/api/community-posts/*", async (route) => {
    const method = route.request().method();
    if (method === "PATCH") {
      resolveCount += 1;
      if (options.failResolve) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Failed to mark post as resolved" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (method === "DELETE") {
      deletePostCount += 1;
      if (options.failDeletePost) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Failed to delete post" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/community-replies/*", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }
    acceptCount += 1;
    if (options.failAccept) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Failed to mark reply as accepted" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/api/community-drafts/*", async (route) => {
    if (route.request().method() !== "DELETE") {
      await route.fallback();
      return;
    }
    deleteDraftCount += 1;
    if (options.failDeleteDraft) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Failed to delete draft" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/api/community-posts", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    postDraftCount += 1;
    if (options.failPostDraft) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Failed to post draft." }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, _id: "posted-1" }),
    });
  });

  return {
    getResolveCount: () => resolveCount,
    getAcceptCount: () => acceptCount,
    getDeletePostCount: () => deletePostCount,
    getDeleteDraftCount: () => deleteDraftCount,
    getPostDraftCount: () => postDraftCount,
  };
}

test.describe("community profile page", () => {
  test("renders profile sections, stats, and loaded lists", async ({ page }) => {
    await seedStudentSession(page);
    await installProfileApiMock(page);
    await page.goto("http://localhost:3000/community/profile");

    await expect(page.locator("header").getByText("Profile", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Profile Test Student" })).toBeVisible();
    await expect(page.getByText("Testing the profile page thoroughly.", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Current posts" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Resolved posts" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Archive posts" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Draft posts" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Open post from profile" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Resolved profile post" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Archived profile post" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Draft from profile" })).toBeVisible();
  });

  test("marks post resolved and marks reply accepted", async ({ page }) => {
    await seedStudentSession(page);
    const mock = await installProfileApiMock(page);
    await page.goto("http://localhost:3000/community/profile");

    const openCard = page.locator(".ui-card").filter({ hasText: "Open post from profile" }).first();
    await openCard.getByRole("button", { name: "Mark Resolved" }).click();
    await expect.poll(() => mock.getResolveCount()).toBeGreaterThan(0);
    await expect(openCard.getByRole("button", { name: "Resolved" })).toBeVisible();

    await openCard.getByRole("button", { name: "1" }).click();
    await openCard.getByRole("button", { name: "Mark Accepted" }).click();
    await expect.poll(() => mock.getAcceptCount()).toBeGreaterThan(0);
    await expect(openCard.getByRole("button", { name: "Accepted" })).toBeVisible();
  });

  test("deletes a current post from confirmation dialog", async ({ page }) => {
    await seedStudentSession(page);
    const mock = await installProfileApiMock(page);
    await page.goto("http://localhost:3000/community/profile");

    const openCard = page.locator(".ui-card").filter({ hasText: "Open post from profile" }).first();
    await openCard.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("heading", { name: "Delete this post?" })).toBeVisible();
    await page.getByRole("button", { name: "Delete post" }).click();
    await expect.poll(() => mock.getDeletePostCount()).toBeGreaterThan(0);
    await expect(page.getByRole("heading", { name: "Open post from profile" })).not.toBeVisible();
  });

  test("deletes draft via confirmation dialog", async ({ page }) => {
    await seedStudentSession(page);
    const mock = await installProfileApiMock(page);
    await page.goto("http://localhost:3000/community/profile");

    const draftCard = page.locator(".ui-card").filter({ hasText: "Draft from profile" }).first();
    await draftCard.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("heading", { name: "Delete this draft?" })).toBeVisible();
    await page.getByRole("button", { name: "Delete draft" }).click();
    await expect.poll(() => mock.getDeleteDraftCount()).toBeGreaterThan(0);
  });

  test("posts draft via confirmation dialog", async ({ page }) => {
    await seedStudentSession(page);
    const mock = await installProfileApiMock(page);
    await page.goto("http://localhost:3000/community/profile");

    const draftCard = page.locator(".ui-card").filter({ hasText: "Draft from profile" }).first();
    await draftCard.getByRole("button", { name: "Post" }).click();
    await expect(page.getByRole("heading", { name: "Post to the community?" })).toBeVisible();
    await page.getByRole("button", { name: "Post" }).last().click();
    await expect.poll(() => mock.getPostDraftCount()).toBeGreaterThan(0);
  });

  test("shows API errors for load and action failures", async ({ page }) => {
    await seedStudentSession(page);
    await installProfileApiMock(page, { failLoadPosts: true, failLoadDrafts: true });
    await page.goto("http://localhost:3000/community/profile");

    await expect(page.getByText("Failed to load posts", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Failed to load drafts", { exact: true })).toBeVisible();
  });

  test("shows action errors for failed resolve/accept/delete/post", async ({ page }) => {
    await seedStudentSession(page);
    await installProfileApiMock(page, {
      failResolve: true,
      failAccept: true,
      failDeletePost: true,
      failDeleteDraft: true,
      failPostDraft: true,
    });
    await page.goto("http://localhost:3000/community/profile");

    const openCard = page.locator(".ui-card").filter({ hasText: "Open post from profile" }).first();
    await openCard.getByRole("button", { name: "Mark Resolved" }).click();
    await expect(
      page.getByText("Failed to mark post as resolved", { exact: true }).first()
    ).toBeVisible();

    await openCard.getByRole("button", { name: "1" }).click();
    await openCard.getByRole("button", { name: "Mark Accepted" }).click();
    await expect(
      page.getByText("Failed to mark reply as accepted", { exact: true }).first()
    ).toBeVisible();

    await openCard.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete post" }).click();
    await expect(
      page.getByText("Failed to delete post", { exact: true }).first()
    ).toBeVisible();
    await page
      .getByRole("dialog", { name: "Delete this post?" })
      .getByRole("button", { name: "Cancel" })
      .click();

    const draftCard = page.locator(".ui-card").filter({ hasText: "Draft from profile" }).first();
    await draftCard.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete draft" }).click();
    await expect(page.getByText("Failed to delete draft", { exact: true })).toBeVisible();
    await page
      .getByRole("dialog", { name: "Delete this draft?" })
      .getByRole("button", { name: "Cancel" })
      .click();

    await draftCard.getByRole("button", { name: "Post" }).click();
    await page.getByRole("button", { name: "Post" }).last().click();
    await expect(page.getByText("Failed to post draft.", { exact: true })).toBeVisible();
  });

  test("shows empty states when no posts and drafts exist", async ({ page }) => {
    await seedStudentSession(page);
    await installProfileApiMock(page, { posts: [], drafts: [] });
    await page.goto("http://localhost:3000/community/profile");

    await expect(page.getByText("No posts yet.", { exact: true })).toBeVisible();
    await expect(page.getByText("No resolved posts yet.", { exact: true })).toBeVisible();
    await expect(page.getByText("No archived posts yet.", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "Save a draft from the create section above. Your saved drafts will appear here for quick update, delete, or post actions.",
        { exact: true }
      )
    ).toBeVisible();
  });

  test("mobile: toggles sidebar and shows section links", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedStudentSession(page);
    await installProfileApiMock(page);
    await page.goto("http://localhost:3000/community/profile");

    await expect(page.getByRole("button", { name: "Toggle sidebar" })).toBeVisible();
    await page.getByRole("button", { name: "Toggle sidebar" }).click();
    await expect(page.getByRole("navigation", { name: "Profile sections" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit profile" })).toBeVisible();
  });
});

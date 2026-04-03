"use client";

import { readCommunityProfileSettings } from "@/lib/community-profile";
import { readStoredUser } from "@/lib/rbac";
import type {
  CommunityPostDraft,
  CommunityPostDraftInput,
} from "@/components/community/CommunityPostComposer";

/**
 * Persists a community post draft via POST or PATCH. Throws on network/API errors or if not logged in.
 */
export async function saveCommunityDraftApi(
  draft: CommunityPostDraftInput
): Promise<CommunityPostDraft> {
  const storedUser = readStoredUser();
  if (!storedUser?.id) {
    throw new Error("Log in to save a draft.");
  }

  const profileSettings = readCommunityProfileSettings();
  const authorDisplayName =
    profileSettings.displayName.trim() ||
    storedUser?.name?.trim() ||
    "Current User";

  const payload = {
    title: draft.title,
    description: draft.description,
    category: draft.category,
    tags: draft.tags,
    attachments: draft.attachments,
    pictureUrl: draft.pictureUrl,
    status: draft.status,
    isUrgent: draft.isUrgent,
    urgentLevel: draft.urgentLevel,
    urgentPaymentMethod: draft.urgentPaymentMethod,
    urgentPrepayId: draft.urgentPrepayId ?? null,
    urgentCardLast4: draft.urgentCardLast4 ?? null,
    author: storedUser.id,
    authorName: authorDisplayName,
    authorUsername: storedUser.username ?? "",
    authorEmail: storedUser.email ?? "",
    authorDisplayName,
    userId: storedUser.id,
  };

  const endpoint = draft.id
    ? `/api/community-drafts/${encodeURIComponent(draft.id)}`
    : "/api/community-drafts";
  const method = draft.id ? "PATCH" : "POST";

  const res = await fetch(endpoint, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Failed to save draft");
  }

  return (await res.json()) as CommunityPostDraft;
}

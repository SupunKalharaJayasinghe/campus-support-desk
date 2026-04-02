"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Archive,
    Award,
    BookMarked,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    CirclePlus,
    Eye,
    FilePenLine,
    FileText,
    ArrowLeft,
    Home,
    Menu,
    MessageSquare,
    Search,
    Settings,
    Settings2,
    ThumbsUp,
    User,
    Users,
    X,
} from "lucide-react";
import Card from "@/components/ui/Card";
import CommunityReplyAttachment from "@/components/community/CommunityReplyAttachment";
import CommunityPostComposer, {
    type CommunityPostDraftInput,
    type CommunityPostDraft,
} from "@/components/community/CommunityPostComposer";
import communityBackground from "@/app/images/community/community2.jpg";
import { saveCommunityDraftApi } from "@/lib/community-draft-api";
import { readCommunityProfileSettings } from "@/lib/community-profile";
import { readStoredUser } from "@/lib/rbac";

type DbCommunityReply = {
    _id: string;
    postId: string;
    authorDisplayName?: string;
    message: string;
    createdAt?: string;
    isAccepted?: boolean;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
};

type DbCommunityPost = {
    _id: string;
    title: string;
    description: string;
    category: "lost_item" | "study_material" | "academic_question";
    pictureUrl?: string | null;
    status?: "open" | "resolved" | "archived";
    createdAt?: string;
    likesCount?: number;
    repliesCount?: number;
    replies?: DbCommunityReply[];
};

const PROFILE_FALLBACK: {
    joined: string;
    about: string;
    stats: {
        posts: number;
        replies: number;
    };
    recentPosts: {
        id: number;
        title: string;
        category: string;
        time: string;
        likes: number;
        replies: number;
    }[];
    recentReplies: {
        id: number;
        postTitle: string;
        content: string;
        time: string;
    }[];
    archivedPosts: {
        id: number;
        title: string;
        category: string;
        time: string;
        likes: number;
        replies: number;
    }[];
} = {
    joined: "Aug 2024",
    about: "Passionate about helping classmates with coursework, project planning, and campus life tips.",
    stats: {
        posts: 42,
        replies: 156,
    },
    recentPosts: [
        { id: 1, title: "How to prepare for Data Structures Exam?", category: "academic_question", time: "2 days ago", likes: 12, replies: 4 },
        { id: 2, title: "Found a blue water bottle near library", category: "lost_item", time: "1 week ago", likes: 3, replies: 1 },
    ],
    recentReplies: [
        { id: 1, postTitle: "Best resources for learning Next.js 14?", content: "I strongly recommend the official Next.js documentation...", time: "1 day ago" },
    ],
    archivedPosts: [
        { id: 101, title: "Old notice: lab hours during midterms", category: "academic_question", time: "3 months ago", likes: 8, replies: 2 },
        { id: 102, title: "Textbook swap — Calculus II", category: "study_material", time: "5 months ago", likes: 15, replies: 6 },
    ],
};

function roleToCommunityLabel(role: string | undefined) {
    if (role === "SUPER_ADMIN") return "Community Admin";
    if (role === "LECTURER") return "Verified Mentor";
    if (role === "LOST_ITEM_STAFF") return "Support Staff";
    return "Student Member";
}

function pickFiniteNumber(value: unknown, fallback: number): number {
    if (value === undefined || value === null) return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function formatJoinedFromCreatedAt(createdAt: unknown, fallback: string): string {
    if (createdAt === undefined || createdAt === null) return fallback;
    const d =
        createdAt instanceof Date
            ? createdAt
            : typeof createdAt === "string"
              ? new Date(createdAt)
              : new Date(String(createdAt));
    if (Number.isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function CommunityProfilePage() {
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [userPosts, setUserPosts] = useState<DbCommunityPost[] | null>(null);
    const [userPostsError, setUserPostsError] = useState<string | null>(null);
    const [resolvingPostId, setResolvingPostId] = useState<string | null>(null);
    const [acceptingReplyId, setAcceptingReplyId] = useState<string | null>(null);
    const [expandedResolvedReplies, setExpandedResolvedReplies] = useState<Record<string, boolean>>({});
    const [draftPosts, setDraftPosts] = useState<CommunityPostDraft[]>([]);
    const [draftInUpdateModal, setDraftInUpdateModal] =
        useState<CommunityPostDraft | null>(null);
    const [draftDeleteConfirm, setDraftDeleteConfirm] = useState<{
        id: string;
        title: string;
    } | null>(null);
    const [draftPostConfirm, setDraftPostConfirm] =
        useState<CommunityPostDraft | null>(null);
    const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
    const [postingDraftId, setPostingDraftId] = useState<string | null>(null);
    const [draftActionError, setDraftActionError] = useState<string | null>(null);

    const [profileData, setProfileData] = useState(() => ({
        ...PROFILE_FALLBACK,
        name: "Current User",
        role: "Student Member",
        about: PROFILE_FALLBACK.about,
        username: "-",
        email: "-",
        faculty: "Computing",
        studyYear: "Year 2",
        points: 0,
        userId: "",
    }));

    useEffect(() => {
        const storedUser = readStoredUser();
        const settings = readCommunityProfileSettings();

        setProfileData({
            ...PROFILE_FALLBACK,
            name:
                settings.displayName ||
                storedUser?.name ||
                storedUser?.username ||
                "Current User",
            role: roleToCommunityLabel(storedUser?.role),
            about: settings.bio || PROFILE_FALLBACK.about,
            username: settings.username || storedUser?.username || "-",
            email: settings.email || storedUser?.email || "-",
            faculty: settings.faculty,
            studyYear: settings.studyYear,
            points: 0,
            userId: storedUser?.id || "",
        });
    }, []);

    const loadDbCommunityProfile = useCallback(async () => {
        const storedUser = readStoredUser();
        const userId = storedUser?.id;
        if (!userId) return;
        try {
            const res = await fetch(
                `/api/community-profile?userId=${encodeURIComponent(userId)}`
            );
            if (!res.ok) return;
            const db = (await res.json().catch(() => null)) as
                | {
                      displayName?: string;
                      username?: string;
                      email?: string;
                      bio?: string;
                      faculty?: string;
                      studyYear?: string;
                      status?: "PUBLIC" | "PRIVATE";
                      points?: unknown;
                      postsCount?: unknown;
                      openPostsCount?: unknown;
                      repliesCount?: unknown;
                      createdAt?: unknown;
                  }
                | null;
            if (!db) return;

            const ptsRaw = Number(db.points);
            const pointsFromDb = Number.isFinite(ptsRaw) ? ptsRaw : null;

            setProfileData((prev) => ({
                ...prev,
                name:
                    String(db.displayName ?? "").trim() ||
                    prev.name ||
                    storedUser?.name ||
                    storedUser?.username ||
                    "Current User",
                about: String(db.bio ?? "").trim() || prev.about,
                username: String(db.username ?? "").trim() || prev.username,
                email: String(db.email ?? "").trim() || prev.email,
                faculty: String(db.faculty ?? "").trim() || prev.faculty,
                studyYear: String(db.studyYear ?? "").trim() || prev.studyYear,
                joined: formatJoinedFromCreatedAt(db.createdAt, prev.joined),
                stats: {
                    posts: pickFiniteNumber(
                        db.openPostsCount !== undefined && db.openPostsCount !== null
                            ? db.openPostsCount
                            : db.postsCount,
                        0
                    ),
                    replies: pickFiniteNumber(db.repliesCount, 0),
                },
                points: pointsFromDb !== null ? pointsFromDb : prev.points,
            }));
        } catch {
            // ignore — local settings already shown
        }
    }, []);

    useEffect(() => {
        void loadDbCommunityProfile();
    }, [loadDbCommunityProfile]);

    useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState === "visible") void loadDbCommunityProfile();
        };
        document.addEventListener("visibilitychange", onVisibility);
        return () => document.removeEventListener("visibilitychange", onVisibility);
    }, [loadDbCommunityProfile]);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                setUserPostsError(null);
                const userId = profileData.userId;
                if (!userId) {
                    setUserPosts([]);
                    return;
                }
                const res = await fetch(`/api/community-user-posts?userId=${encodeURIComponent(userId)}`);
                if (!res.ok) {
                    const body = (await res.json().catch(() => null)) as { error?: string } | null;
                    throw new Error(body?.error || "Failed to load posts");
                }
                const data = (await res.json()) as DbCommunityPost[];
                if (!cancelled) {
                    setUserPosts(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                if (!cancelled) {
                    setUserPosts([]);
                    setUserPostsError(err instanceof Error ? err.message : "Failed to load posts");
                }
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [profileData.userId]);

    useEffect(() => {
        let cancelled = false;
        async function loadDrafts() {
            try {
                setDraftActionError(null);
                const userId = profileData.userId;
                if (!userId) {
                    setDraftPosts([]);
                    return;
                }
                const res = await fetch(
                    `/api/community-drafts?userId=${encodeURIComponent(userId)}`
                );
                if (!res.ok) {
                    const body = (await res.json().catch(() => null)) as
                        | { error?: string }
                        | null;
                    throw new Error(body?.error || "Failed to load drafts");
                }
                const data = (await res.json()) as CommunityPostDraft[];
                if (!cancelled) {
                    setDraftPosts(Array.isArray(data) ? data : []);
                }
            } catch (error) {
                if (!cancelled) {
                    setDraftPosts([]);
                    setDraftActionError(
                        error instanceof Error ? error.message : "Failed to load drafts"
                    );
                }
            }
        }
        loadDrafts();
        return () => {
            cancelled = true;
        };
    }, [profileData.userId]);

    const filteredRecentPosts = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return profileData.recentPosts;
        return profileData.recentPosts.filter((p) => p.title.toLowerCase().includes(q));
    }, [profileData.recentPosts, searchQuery]);

    const filteredArchivedPosts = useMemo(() => {
        if (!userPosts) return [];
        const q = searchQuery.trim().toLowerCase();
        return userPosts.filter((post) => {
            if (post.status !== "archived") return false;
            if (!q) return true;
            return (
                post.title?.toLowerCase().includes(q) ||
                post.description?.toLowerCase().includes(q)
            );
        });
    }, [userPosts, searchQuery]);

    const filteredResolvedPosts = useMemo(() => {
        if (!userPosts) return [];
        const q = searchQuery.trim().toLowerCase();
        return userPosts.filter((post) => {
            if (post.status !== "resolved") return false;
            if (!q) return true;
            return (
                post.title?.toLowerCase().includes(q) ||
                post.description?.toLowerCase().includes(q)
            );
        });
    }, [userPosts, searchQuery]);

    const filteredCurrentOpenPosts = useMemo(() => {
        if (!userPosts) return [];
        const q = searchQuery.trim().toLowerCase();
        return userPosts
            .filter((post) => (post.status ?? "open") === "open")
            .filter((post) => {
                if (!q) return true;
                return (
                    post.title?.toLowerCase().includes(q) ||
                    post.description?.toLowerCase().includes(q)
                );
            });
    }, [userPosts, searchQuery]);

    /** Open (current) post count: live from loaded posts when available, else profile API value. */
    const currentOpenPostsCount = useMemo(() => {
        if (!userPosts) return profileData.stats.posts;
        return userPosts.filter((post) => (post.status ?? "open") === "open").length;
    }, [userPosts, profileData.stats.posts]);

    const filteredRecentReplies = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return profileData.recentReplies;
        return profileData.recentReplies.filter(
            (r) =>
                r.postTitle.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)
        );
    }, [profileData.recentReplies, searchQuery]);

    /** Only collapse the drawer on small screens; desktop sidebar stays open unless the user uses the menu button. */
    const closeSidebarIfMobile = useCallback(() => {
        if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
            setSidebarOpen(false);
        }
    }, []);

    const handleBackToStudentPage = () => {
        closeSidebarIfMobile();
        router.push("/student");
    };

    const handleMarkResolved = useCallback(async (postId: string) => {
        try {
            setResolvingPostId(postId);
            setUserPostsError(null);
            const res = await fetch(`/api/community-posts/${encodeURIComponent(postId)}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ status: "resolved" }),
            });
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null;
                throw new Error(body?.error || "Failed to mark post as resolved");
            }

            setUserPosts((prev) =>
                prev
                    ? prev.map((post) =>
                          post._id === postId ? { ...post, status: "resolved" } : post
                      )
                    : prev
            );
        } catch (error) {
            setUserPostsError(
                error instanceof Error ? error.message : "Failed to mark post as resolved"
            );
        } finally {
            setResolvingPostId(null);
        }
    }, []);

    const handleMarkReplyAccepted = useCallback(
        async (postId: string, replyId: string) => {
            try {
                setAcceptingReplyId(replyId);
                setUserPostsError(null);
                const res = await fetch(
                    `/api/community-replies/${encodeURIComponent(replyId)}`,
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ isAccepted: true }),
                    }
                );
                if (!res.ok) {
                    const body = (await res.json().catch(() => null)) as
                        | { error?: string }
                        | null;
                    throw new Error(body?.error || "Failed to mark reply as accepted");
                }

                setUserPosts((prev) =>
                    prev
                        ? prev.map((post) => {
                              if (post._id !== postId) return post;
                              return {
                                  ...post,
                                  replies: (post.replies ?? []).map((reply) => ({
                                      ...reply,
                                      isAccepted: reply._id === replyId,
                                  })),
                              };
                          })
                        : prev
                );
            } catch (error) {
                setUserPostsError(
                    error instanceof Error ? error.message : "Failed to mark reply as accepted"
                );
            } finally {
                setAcceptingReplyId(null);
            }
        },
        []
    );

    const toggleResolvedReplies = useCallback((postId: string) => {
        setExpandedResolvedReplies((prev) => ({
            ...prev,
            [postId]: !prev[postId],
        }));
    }, []);

    const handleDraftSaved = useCallback(
        async (draft: CommunityPostDraftInput) => {
            const savedDraft = await saveCommunityDraftApi(draft).catch((e) => {
                const message = e instanceof Error ? e.message : "Failed to save draft";
                setDraftActionError(message);
                throw e instanceof Error ? e : new Error(message);
            });
            setDraftPosts((prev) => {
                const exists = prev.some((item) => item.id === savedDraft.id);
                const next = exists
                    ? prev.map((item) => (item.id === savedDraft.id ? savedDraft : item))
                    : [savedDraft, ...prev];
                return next.sort(
                    (a, b) =>
                        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                );
            });
            setDraftActionError(null);
            // Keep update modal open with server data so picture and edits stay visible after save.
            setDraftInUpdateModal((m) =>
                m && savedDraft.id === m.id ? savedDraft : m
            );
            if (!draft.id) {
                document
                    .getElementById("draft-posts")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            return savedDraft;
        },
        []
    );

    const handleDraftDeleted = useCallback(
        async (draftId: string) => {
            const userId = profileData.userId;
            if (!userId) return;

            const res = await fetch(
                `/api/community-drafts/${encodeURIComponent(
                    draftId
                )}?userId=${encodeURIComponent(userId)}`,
                { method: "DELETE" }
            );

            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as
                    | { error?: string }
                    | null;
                const message = body?.error || "Failed to delete draft";
                setDraftActionError(message);
                throw new Error(message);
            }

            setDraftPosts((prev) => prev.filter((draft) => draft.id !== draftId));
            setDraftActionError(null);
            setDraftInUpdateModal((prev) => (prev?.id === draftId ? null : prev));
        },
        [profileData.userId]
    );

    const handleDraftPostedFromComposer = useCallback(
        async (draftId?: string) => {
            if (!draftId) return;
            try {
                await handleDraftDeleted(draftId);
            } catch {
                // Keep post success flow even if draft cleanup fails.
            }
        },
        [handleDraftDeleted]
    );

    const handleDraftUpdate = useCallback((draft: CommunityPostDraft) => {
        setDraftInUpdateModal(draft);
        setDraftActionError(null);
    }, []);

    const confirmDraftDelete = useCallback(async () => {
        const pending = draftDeleteConfirm;
        if (!pending) return;
        setDeletingDraftId(pending.id);
        try {
            await handleDraftDeleted(pending.id);
            setDraftDeleteConfirm(null);
        } catch {
            // Error surfaced via draftActionError from handleDraftDeleted
        } finally {
            setDeletingDraftId(null);
        }
    }, [draftDeleteConfirm, handleDraftDeleted]);

    useEffect(() => {
        if (!draftInUpdateModal && !draftDeleteConfirm && !draftPostConfirm) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (
                draftPostConfirm &&
                postingDraftId === draftPostConfirm.id
            ) {
                return;
            }
            setDraftInUpdateModal(null);
            setDraftDeleteConfirm(null);
            setDraftPostConfirm(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [draftInUpdateModal, draftDeleteConfirm, draftPostConfirm, postingDraftId]);

    const handleDraftPostNow = useCallback(
        async (draft: CommunityPostDraft) => {
            try {
                setPostingDraftId(draft.id);
                setDraftActionError(null);
                const storedUser = readStoredUser();
                const profileSettings = readCommunityProfileSettings();
                const authorDisplayName =
                    profileSettings.displayName.trim() ||
                    storedUser?.name?.trim() ||
                    "Current User";

                const res = await fetch("/api/community-posts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        clientRequestId: draft.id,
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
                        urgentCardPaymentRecordId: draft.urgentCardPaymentRecordId ?? null,
                        author: storedUser?.id,
                        authorName: authorDisplayName,
                        authorUsername: storedUser?.username ?? "",
                        authorEmail: storedUser?.email ?? "",
                        authorDisplayName,
                    }),
                });

                if (!res.ok) {
                    const data = (await res.json().catch(() => null)) as
                        | { error?: string }
                        | null;
                    throw new Error(data?.error ?? "Failed to post draft.");
                }

                try {
                    await handleDraftDeleted(draft.id);
                } catch {
                    // Keep post success flow even if draft cleanup fails.
                }
                router.push("/community");
            } catch (error) {
                setDraftActionError(
                    error instanceof Error ? error.message : "Failed to post draft."
                );
            } finally {
                setPostingDraftId(null);
            }
        },
        [handleDraftDeleted, router]
    );

    const confirmDraftPost = useCallback(async () => {
        const draft = draftPostConfirm;
        if (!draft) return;
        try {
            await handleDraftPostNow(draft);
        } finally {
            setDraftPostConfirm(null);
        }
    }, [draftPostConfirm, handleDraftPostNow]);

    return (
        <main
            className="relative h-screen overflow-hidden text-[#0f0f0f]"
            style={{
                backgroundImage: `url(${communityBackground.src})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
            }}
        >
            <div className="absolute inset-0 bg-slate-100/70" />
            <div className="relative z-10 h-full">
                <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-blue-200 bg-slate-50/95 backdrop-blur-sm">
                    <div className="flex h-full items-center justify-between gap-3 px-3 sm:px-5">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setSidebarOpen((prev) => !prev)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-blue-100"
                                aria-label="Toggle sidebar"
                            >
                                <Menu size={22} />
                            </button>
                            <div className="flex items-center gap-2">
                                <div className="rounded-md bg-blue-700 px-2 py-1 text-xs font-bold text-white">UNIHUB</div>
                                <span className="text-lg font-bold tracking-tight text-slate-800">Profile</span>
                            </div>
                        </div>
                        

                        <div className="flex items-center gap-2 sm:gap-3">
                            <Link
                                href="#create-post"
                                className="inline-flex h-10 items-center gap-2 rounded-full bg-blue-100 px-3 text-sm font-semibold text-blue-800 hover:bg-blue-200 sm:px-4"
                                onClick={closeSidebarIfMobile}
                            >
                                <CirclePlus size={18} />
                                <span className="hidden sm:inline">Create</span>
                            </Link>
                            <div className="relative">
                            <button
                                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-700 text-white"
                            >
                                <User size={18} />
                            </button>
                            </div>

                            
                        </div>
                    </div>
                </header>

                <div className="flex h-full pt-16">
                    {sidebarOpen && (
                        <button
                            type="button"
                            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
                            aria-label="Close sidebar"
                            onClick={() => setSidebarOpen(false)}
                        />
                    )}

                    <aside
                        className={`fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-72 border-r border-blue-100 bg-slate-100/95 p-3 transition-transform lg:sticky lg:top-16 lg:translate-x-0 ${
                            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:hidden"
                        }`}
                    >
                        <nav aria-label="Profile sections" className="flex h-full flex-col">
                            <div className="space-y-1">
                                <Link
                                    href="/community"
                                    className="flex items-center gap-3 rounded-xl bg-blue-100 px-3 py-2.5 text-sm font-semibold text-blue-900 hover:bg-blue-900 hover:text-white"
                                    onClick={closeSidebarIfMobile}
                                >
                                    <Home size={18} /> Home
                                </Link>
                                <Link
                                    href="/community/profile"
                                    className="flex items-center gap-3 rounded-xl bg-blue-800 px-3 py-2.5 text-sm font-semibold text-white"
                                    onClick={closeSidebarIfMobile}
                                >
                                    <User size={18} /> Profile
                                </Link>
                            </div>

                            <div className="my-3 h-px bg-blue-100" />

                            <div className="flex-1 space-y-1 overflow-y-auto pr-1">
                                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    On this page
                                </p>
                                 <a
                                    href="#Profile details"
                                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-blue-100"
                                    onClick={closeSidebarIfMobile}
                                >
                                    <User size={18} /> Profile Details
                                </a>
                                <a
                                    href="#create-post"
                                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-blue-100"
                                    onClick={closeSidebarIfMobile}
                                >
                                    <CirclePlus size={18} /> Create post
                                </a>
                                <a
                                    href="#current-posts"
                                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-blue-100"
                                    onClick={closeSidebarIfMobile}
                                >
                                    <FileText size={18} /> Current posts
                                </a>
                                <a
                                    href="#resolved-posts"
                                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-blue-100"
                                    onClick={closeSidebarIfMobile}
                                >
                                    <CheckCircle2 size={18} /> Resolved posts
                                </a>
                                <a
                                    href="#archive-posts"
                                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-blue-100"
                                    onClick={closeSidebarIfMobile}
                                >
                                    <Archive size={18} /> Archive posts
                                </a>
                                <a
                                    href="#draft-posts"
                                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-blue-100"
                                    onClick={closeSidebarIfMobile}
                                >
                                    <FilePenLine size={18} /> Draft posts
                                </a>
                            </div>

                            <div className="my-3 h-px bg-blue-100" />

                            <div className="space-y-1">
                                <Link
                                    href="/community/Settings"
                                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-blue-100"
                                    onClick={closeSidebarIfMobile}
                                >
                                    <Settings2 size={18} /> Edit profile
                                </Link>
                            </div>
                            

                            <button
                                type="button"
                                onClick={handleBackToStudentPage}
                                className="flex w-full items-center gap-3 rounded-xl bg-red-100 px-3 py-2.5 text-sm font-semibold text-red-900 hover:bg-red-900 hover:text-white"
                            >
                                <ArrowLeft size={18} /> Back to student page
                            </button>
                        
                            
                           
                        </nav>
                    </aside>

                    <section className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
                        <div id="Profile details" className="rounded-2xl border border-blue-200 bg-slate-50/90 p-4 shadow-shadow sm:rounded-3xl md:p-5 lg:p-6">
                            <div className="space-y-5">
                    <div className="rounded-3xl border border-blue-100 bg-gradient-to-r from-white to-blue-50 p-6 md:p-7">
                        <div className="flex flex-col gap-6 md:flex-row md:items-start">
                            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-100 text-blue-700 shadow-inner">
                                    <User size={46} />
                                </div>
                                <div className="text-center sm:text-left">
                                    <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                                        <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">{profileData.name}</h1>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-700 px-3 py-1 text-xs font-semibold text-white">
                                            <CheckCircle2 size={13} />
                                            {profileData.role}
                                        </span>
                                    </div>
                                    <p className="mt-2 flex items-center justify-center gap-2 text-sm text-slate-600 sm:justify-start">
                                        <CalendarDays size={15} /> Joined {profileData.joined}
                                    </p>
                                    <p className="mt-2 text-xs text-slate-600">Username: {profileData.username}</p>
                                    <p className="mt-1 text-xs text-slate-600">Email: {profileData.email}</p>
                                    <p className="mt-1 text-xs text-slate-600">
                                        {profileData.faculty} - {profileData.studyYear}
                                    </p>
                                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-700">{profileData.about}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
                        <Card className="rounded-2xl border border-blue-100 bg-white p-4 shadow-none">
                            <p className="mb-2 inline-flex rounded-lg bg-emerald-100 p-2 text-emerald-700">
                                <Award size={16} />
                            </p>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Points</p>
                            <p className="mt-1 text-2xl font-bold text-slate-800">{profileData.points}</p>
                        </Card>
                        <Card className="rounded-2xl border border-blue-100 bg-white p-4 shadow-none">
                            <p className="mb-2 inline-flex rounded-lg bg-blue-100 p-2 text-blue-700">
                                <FileText size={16} />
                            </p>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Posts</p>
                            <p className="mt-1 text-2xl font-bold text-slate-800">{currentOpenPostsCount}</p>
                        </Card>
                        <Card className="rounded-2xl border border-blue-100 bg-white p-4 shadow-none">
                            <p className="mb-2 inline-flex rounded-lg bg-cyan-100 p-2 text-cyan-700">
                                <MessageSquare size={16} />
                            </p>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Replies</p>
                            <p className="mt-1 text-2xl font-bold text-slate-800">{profileData.stats.replies}</p>
                        </Card>
                    </div>

                   

                    <div id="create-post" className="mt-10 scroll-mt-6">
                        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
                            <CirclePlus size={20} className="text-blue-700" /> Create post
                        </h2>
                        <p className="mb-4 text-sm text-slate-600">
                            Use the same composer as the full create page. Save draft, then post — you will be taken to the community feed when it succeeds.
                        </p>
                        <CommunityPostComposer
                            compact
                            className="shadow-shadow"
                            resetAfterDraftSave
                            draftToEdit={null}
                            onDraftSaved={handleDraftSaved}
                            urgentDoneNavigatesTo="#draft-posts"
                            onDraftDeleted={(draftId) => {
                                handleDraftDeleted(draftId).catch(() => undefined);
                            }}
                            onPostSuccess={handleDraftPostedFromComposer}
                        />
                        <p className="mt-4 text-center text-sm text-slate-600">
                            Prefer a dedicated page?{" "}
                            <Link
                                href="/community/post/create"
                                className="font-semibold text-blue-700 underline-offset-2 hover:underline"
                                onClick={closeSidebarIfMobile}
                            >
                                Open create post page
                            </Link>
                        </p>
                    </div>

                    <div className="mt-7 grid grid-cols-1 gap-6">
                        <div id="current-posts" className="scroll-mt-6">
                            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
                                <FileText size={20} className="text-blue-700" /> Current posts
                            </h2>
                            <div className="space-y-4">
                                <div id="current post" />
                                {userPostsError && (
                                    <Card className="rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-700 shadow-none">
                                        {userPostsError}
                                    </Card>
                                )}
                                {userPosts === null ? (
                                    <Card className="rounded-2xl border border-blue-100 bg-white p-4 text-sm text-slate-600 shadow-none">
                                        Loading your posts…
                                    </Card>
                                ) : userPosts.length === 0 ? (
                                    <Card className="rounded-2xl border border-blue-100 bg-white p-4 text-sm text-slate-600 shadow-none">
                                        No posts yet.
                                    </Card>
                                ) : filteredCurrentOpenPosts.length === 0 ? (
                                    <Card className="rounded-2xl border border-blue-100 bg-white p-4 text-sm text-slate-600 shadow-none">
                                        No open posts right now.
                                    </Card>
                                ) : (
                                    filteredCurrentOpenPosts
                                        .slice(0, 1)
                                        .map((post) => (
                                            <Card
                                                key={post._id}
                                                className="rounded-2xl border border-blue-100 bg-white p-4 shadow-none"
                                            >
                                                <div className="mb-3 flex items-start justify-between gap-2">
                                                    <span className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-800">
                                                        {String(post.category).replace("_", " ")}
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        {post.createdAt
                                                            ? new Date(post.createdAt).toLocaleString()
                                                            : ""}
                                                    </span>
                                                </div>
                                                <h3 className="text-base font-semibold leading-snug text-slate-800">
                                                    {post.title}
                                                </h3>
                                                <div className="mt-2 flex items-center justify-between gap-2">
                                                    <span
                                                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                                                            post.status === "resolved"
                                                                ? "bg-green-100 text-green-700"
                                                                : "bg-amber-100 text-amber-700"
                                                        }`}
                                                    >
                                                        {post.status === "resolved" ? "Resolved" : "Open"}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMarkResolved(post._id)}
                                                        disabled={
                                                            post.status === "resolved" ||
                                                            resolvingPostId === post._id
                                                        }
                                                        className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                                    >
                                                        {resolvingPostId === post._id
                                                            ? "Updating..."
                                                            : post.status === "resolved"
                                                            ? "Resolved"
                                                            : "Mark Resolved"}
                                                    </button>
                                                </div>
                                                <p className="mt-2 line-clamp-3 text-sm text-slate-700">
                                                    {post.description}
                                                </p>
                                                {post.pictureUrl ? (
                                                    <div className="mt-3 overflow-hidden rounded-xl border border-blue-100 bg-slate-50">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={post.pictureUrl}
                                                            alt=""
                                                            className="max-h-56 w-full object-contain"
                                                        />
                                                    </div>
                                                ) : null}
                                                <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-slate-600">
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <ThumbsUp size={14} /> {post.likesCount ?? 0}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <MessageSquare size={14} /> {post.repliesCount ?? 0}
                                                    </span>
                                                </div>

                                                {(post.replies?.length ?? 0) > 0 && (
                                                    <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3">
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                            Replies
                                                        </p>
                                                        {post.replies!.slice(0, 5).map((reply) => (
                                                            <div
                                                                key={reply._id}
                                                                className="rounded-lg bg-white p-3 text-sm text-slate-700"
                                                            >
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <p className="text-xs font-semibold text-slate-500">
                                                                        {reply.authorDisplayName || "Community User"}
                                                                        {reply.createdAt ? (
                                                                            <span className="font-normal">
                                                                                {" "}
                                                                                ·{" "}
                                                                                {new Date(
                                                                                    reply.createdAt
                                                                                ).toLocaleString()}
                                                                            </span>
                                                                        ) : null}
                                                                    </p>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleMarkReplyAccepted(
                                                                                post._id,
                                                                                reply._id
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            reply.isAccepted ||
                                                                            acceptingReplyId === reply._id
                                                                        }
                                                                        className="rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                                                    >
                                                                        {acceptingReplyId === reply._id
                                                                            ? "Updating..."
                                                                            : reply.isAccepted
                                                                            ? "Accepted"
                                                                            : "Mark Accepted"}
                                                                    </button>
                                                                </div>
                                                                {(reply.message ?? "").trim() ? (
                                                                    <p className="mt-1 whitespace-pre-wrap">
                                                                        {reply.message}
                                                                    </p>
                                                                ) : reply.attachmentUrl ? (
                                                                    <p className="mt-1 text-xs italic text-slate-500">
                                                                        Attachment only
                                                                    </p>
                                                                ) : null}
                                                                {reply.attachmentUrl ? (
                                                                    <CommunityReplyAttachment
                                                                        attachmentUrl={reply.attachmentUrl}
                                                                        attachmentName={
                                                                            reply.attachmentName ?? undefined
                                                                        }
                                                                        imageClassName="max-h-32"
                                                                    />
                                                                ) : null}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </Card>
                                        ))
                                )}
                                <Link
                                    href="/community/profile/posts"
                                    className="block w-full rounded-2xl border border-dashed border-blue-300 bg-blue-50 py-3 text-center text-sm font-semibold text-blue-800 transition hover:bg-blue-100"
                                    onClick={closeSidebarIfMobile}
                                >
                                    <span className="inline-flex items-center justify-center gap-2">
                                        <Eye size={15} />
                                        View all current posts
                                    </span>
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div id="resolved-posts" className="mt-10 scroll-mt-6">
                        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
                            <CheckCircle2 size={20} className="text-green-600" /> Resolved posts
                        </h2>
                        <p className="mb-4 text-sm text-slate-600">
                            Posts marked as resolved are shown here for quick tracking.
                        </p>
                        <div className="space-y-4">
                            {userPostsError && (
                                <Card className="rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-700 shadow-none">
                                    {userPostsError}
                                </Card>
                            )}
                            {userPosts === null ? (
                                <Card className="rounded-2xl border border-blue-100 bg-white p-4 text-sm text-slate-600 shadow-none">
                                    Loading resolved posts…
                                </Card>
                            ) : filteredResolvedPosts.length === 0 ? (
                                <Card className="rounded-2xl border border-blue-100 bg-white p-4 text-sm text-slate-600 shadow-none">
                                    No resolved posts yet.
                                </Card>
                            ) : (
                                filteredResolvedPosts.map((post) => (
                                    <Card key={post._id} className="rounded-2xl border border-blue-100 bg-white p-4 shadow-none">
                                        <div className="mb-3 flex items-start justify-between gap-2">
                                            <span className="rounded-full bg-green-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-green-700">
                                                {String(post.category).replace("_", " ")}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {post.createdAt
                                                    ? new Date(post.createdAt).toLocaleString()
                                                    : ""}
                                            </span>
                                        </div>
                                        <h3 className="text-base font-semibold leading-snug text-slate-800">{post.title}</h3>
                                        <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-slate-600">
                                            <span className="inline-flex items-center gap-1.5">
                                                <ThumbsUp size={14} /> {post.likesCount ?? 0}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => toggleResolvedReplies(post._id)}
                                                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:bg-slate-100"
                                            >
                                                <MessageSquare size={14} /> {post.repliesCount ?? 0}
                                                <ChevronDown
                                                    size={13}
                                                    className={`transition-transform ${
                                                        expandedResolvedReplies[post._id] ? "rotate-180" : ""
                                                    }`}
                                                />
                                            </button>
                                        </div>
                                        {expandedResolvedReplies[post._id] &&
                                            (post.replies?.length ?? 0) > 0 && (
                                                <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                        Replies
                                                    </p>
                                                    {post.replies!.slice(0, 5).map((reply) => (
                                                        <div
                                                            key={reply._id}
                                                            className="rounded-lg bg-white p-3 text-sm text-slate-700"
                                                        >
                                                            <div className="flex items-start justify-between gap-2">
                                                                <p className="text-xs font-semibold text-slate-500">
                                                                    {reply.authorDisplayName || "Community User"}
                                                                    {reply.createdAt ? (
                                                                        <span className="font-normal">
                                                                            {" "}
                                                                            ·{" "}
                                                                            {new Date(
                                                                                reply.createdAt
                                                                            ).toLocaleString()}
                                                                        </span>
                                                                    ) : null}
                                                                </p>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleMarkReplyAccepted(
                                                                            post._id,
                                                                            reply._id
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        reply.isAccepted ||
                                                                        acceptingReplyId === reply._id
                                                                    }
                                                                    className="rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                                                >
                                                                    {acceptingReplyId === reply._id
                                                                        ? "Updating..."
                                                                        : reply.isAccepted
                                                                        ? "Accepted"
                                                                        : "Mark Accepted"}
                                                                </button>
                                                            </div>
                                                            {(reply.message ?? "").trim() ? (
                                                                <p className="mt-1 whitespace-pre-wrap">
                                                                    {reply.message}
                                                                </p>
                                                            ) : reply.attachmentUrl ? (
                                                                <p className="mt-1 text-xs italic text-slate-500">
                                                                    Attachment only
                                                                </p>
                                                            ) : null}
                                                            {reply.attachmentUrl ? (
                                                                <CommunityReplyAttachment
                                                                    attachmentUrl={reply.attachmentUrl}
                                                                    attachmentName={
                                                                        reply.attachmentName ?? undefined
                                                                    }
                                                                    imageClassName="max-h-32"
                                                                />
                                                            ) : null}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        {expandedResolvedReplies[post._id] &&
                                            (post.replies?.length ?? 0) === 0 && (
                                                <p className="mt-3 text-xs text-slate-500">
                                                    No replies yet.
                                                </p>
                                            )}
                                    </Card>
                                ))
                            )}
                        </div>
                    </div>

                    <div id="archive-posts" className="mt-10 scroll-mt-6">
                        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
                            <Archive size={20} className="text-blue-700" /> Archive posts
                        </h2>
                        <p className="mb-4 text-sm text-slate-600">
                            Older threads you have archived stay here for your reference.
                        </p>
                        <div className="space-y-4">
                            {userPostsError && (
                                <Card className="rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-700 shadow-none">
                                    {userPostsError}
                                </Card>
                            )}
                            {userPosts === null ? (
                                <Card className="rounded-2xl border border-blue-100 bg-white p-4 text-sm text-slate-600 shadow-none">
                                    Loading archived posts…
                                </Card>
                            ) : filteredArchivedPosts.length === 0 ? (
                                <Card className="rounded-2xl border border-blue-100 bg-white p-4 text-sm text-slate-600 shadow-none">
                                    No archived posts yet.
                                </Card>
                            ) : (
                                filteredArchivedPosts.map((post) => (
                                    <Card key={post._id} className="rounded-2xl border border-blue-100 bg-white p-4 shadow-none">
                                        <div className="mb-3 flex items-start justify-between gap-2">
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                                                {String(post.category).replace("_", " ")}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {post.createdAt
                                                    ? new Date(post.createdAt).toLocaleString()
                                                    : ""}
                                            </span>
                                        </div>
                                        <h3 className="text-base font-semibold leading-snug text-slate-800">{post.title}</h3>
                                        <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-slate-600">
                                            <span className="inline-flex items-center gap-1.5">
                                                <ThumbsUp size={14} /> {post.likesCount ?? 0}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5">
                                                <MessageSquare size={14} /> {post.repliesCount ?? 0}
                                            </span>
                                        </div>
                                    </Card>
                                ))
                            )}
                        </div>
                        <Link
                            href="/community/profile/posts/archived"
                            className="mt-4 block w-full rounded-2xl border border-dashed border-blue-300 bg-blue-50 py-3 text-center text-sm font-semibold text-blue-800 transition hover:bg-blue-100"
                            onClick={closeSidebarIfMobile}
                        >
                            <span className="inline-flex items-center justify-center gap-2">
                                <Eye size={15} />
                                View all archived posts
                            </span>
                        </Link>
                    </div>

                    <div id="draft-posts" className="mt-10 scroll-mt-6">
                        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
                            <FilePenLine size={20} className="text-blue-700" /> Draft posts
                        </h2>
                        {draftActionError && (
                            <Card className="mb-4 rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-700 shadow-none">
                                {draftActionError}
                            </Card>
                        )}
                        {draftPosts.length === 0 ? (
                            <Card className="rounded-2xl border border-dashed border-blue-200 bg-white/90 p-6 shadow-none">
                                <p className="text-sm text-slate-600">
                                    Save a draft from the create section above. Your saved drafts will appear here for quick update, delete, or post actions.
                                </p>
                                <a
                                    href="#create-post"
                                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
                                >
                                    <CirclePlus size={16} />
                                    Go to composer
                                </a>
                            </Card>
                        ) : (
                            <div className="space-y-4">
                                {draftPosts.map((draft) => (
                                    <Card
                                        key={draft.id}
                                        className="rounded-2xl border border-blue-100 bg-white p-4 shadow-none"
                                    >
                                        <div className="mb-2 flex items-start justify-between gap-2">
                                            <h3 className="text-base font-semibold leading-snug text-slate-800">
                                                {draft.title}
                                            </h3>
                                            <span className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-800">
                                                {String(draft.category).replace("_", " ")}
                                            </span>
                                        </div>
                                        <p className="line-clamp-2 text-sm text-slate-700">
                                            {draft.description}
                                        </p>
                                        {draft.pictureUrl ? (
                                            <div className="mt-3 overflow-hidden rounded-xl border border-blue-100 bg-slate-50">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={draft.pictureUrl}
                                                    alt=""
                                                    className="max-h-40 w-full object-cover sm:max-h-48"
                                                />
                                            </div>
                                        ) : null}
                                        <p className="mt-2 text-xs text-slate-500">
                                            Updated{" "}
                                            {new Date(draft.updatedAt).toLocaleString()}
                                        </p>
                                        <div className="mt-4 flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                className="rounded-full bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-800"
                                                onClick={() => handleDraftUpdate(draft)}
                                            >
                                                Update
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                                                onClick={() =>
                                                    setDraftDeleteConfirm({
                                                        id: draft.id,
                                                        title: draft.title,
                                                    })
                                                }
                                                disabled={
                                                    postingDraftId === draft.id ||
                                                    deletingDraftId === draft.id
                                                }
                                            >
                                                Delete
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                                onClick={() => setDraftPostConfirm(draft)}
                                                disabled={
                                                    postingDraftId === draft.id ||
                                                    draftPostConfirm?.id === draft.id
                                                }
                                            >
                                                {postingDraftId === draft.id
                                                    ? "Posting..."
                                                    : "Post"}
                                            </button>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-100/60 p-4 text-sm text-blue-900">
                        Keep helping others, and your mentor badge progression will update automatically based on community contributions.
                    </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {draftInUpdateModal && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    role="presentation"
                >
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
                        aria-label="Close update dialog"
                        onClick={() => setDraftInUpdateModal(null)}
                    />
                    <div
                        className="relative z-10 max-h-[min(90vh,900px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-blue-200 bg-slate-50/95 p-4 shadow-xl sm:p-6"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="draft-update-modal-title"
                    >
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <h2
                                id="draft-update-modal-title"
                                className="text-lg font-semibold text-slate-800"
                            >
                                Update draft
                            </h2>
                            <button
                                type="button"
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-blue-100"
                                aria-label="Close"
                                onClick={() => setDraftInUpdateModal(null)}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <CommunityPostComposer
                            compact
                            className="shadow-none"
                            draftToEdit={draftInUpdateModal}
                            onDraftSaved={handleDraftSaved}
                            onDraftDeleted={(draftId) => {
                                handleDraftDeleted(draftId).catch(() => undefined);
                            }}
                            onDraftEditCancel={() => setDraftInUpdateModal(null)}
                            onPostSuccess={handleDraftPostedFromComposer}
                        />
                    </div>
                </div>
            )}

            {draftDeleteConfirm && (
                <div
                    className="fixed inset-0 z-[101] flex items-center justify-center p-4"
                    role="presentation"
                >
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
                        aria-label="Dismiss"
                        onClick={() =>
                            !deletingDraftId && setDraftDeleteConfirm(null)
                        }
                    />
                    <div
                        className="relative z-10 w-full max-w-md rounded-2xl border border-blue-200 bg-white p-6 shadow-xl"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="draft-delete-confirm-title"
                    >
                        <h2
                            id="draft-delete-confirm-title"
                            className="text-lg font-semibold text-slate-800"
                        >
                            Delete this draft?
                        </h2>
                        <p className="mt-3 text-sm text-slate-600">
                            Are you sure you want to delete “{draftDeleteConfirm.title}”?
                            This cannot be undone.
                        </p>
                        <div className="mt-6 flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                onClick={() => setDraftDeleteConfirm(null)}
                                disabled={!!deletingDraftId}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                onClick={() => {
                                    confirmDraftDelete().catch(() => undefined);
                                }}
                                disabled={!!deletingDraftId}
                            >
                                {deletingDraftId ? "Deleting…" : "Delete draft"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {draftPostConfirm && (
                <div
                    className="fixed inset-0 z-[102] flex items-center justify-center p-4"
                    role="presentation"
                >
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
                        aria-label="Dismiss"
                        onClick={() =>
                            postingDraftId !== draftPostConfirm.id &&
                            setDraftPostConfirm(null)
                        }
                    />
                    <div
                        className="relative z-10 w-full max-w-md rounded-2xl border border-blue-200 bg-white p-6 shadow-xl"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="draft-post-confirm-title"
                    >
                        <h2
                            id="draft-post-confirm-title"
                            className="text-lg font-semibold text-slate-800"
                        >
                            Post to the community?
                        </h2>
                        <p className="mt-3 text-sm text-slate-600">
                            This will publish “{draftPostConfirm.title}” to the community feed
                            for everyone to see. The draft will be removed after it is posted.
                        </p>
                        <div className="mt-6 flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                onClick={() => setDraftPostConfirm(null)}
                                disabled={postingDraftId === draftPostConfirm.id}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                onClick={() => {
                                    confirmDraftPost().catch(() => undefined);
                                }}
                                disabled={postingDraftId === draftPostConfirm.id}
                            >
                                {postingDraftId === draftPostConfirm.id
                                    ? "Posting…"
                                    : "Post"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

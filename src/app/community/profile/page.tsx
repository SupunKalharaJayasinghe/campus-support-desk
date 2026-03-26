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
    Flame,
    Home,
    LogOut,
    Menu,
    MessageSquare,
    Search,
    Settings,
    Settings2,
    Star,
    ThumbsUp,
    User,
    Users,
} from "lucide-react";
import Card from "@/components/ui/Card";
import CommunityPostComposer from "@/components/community/CommunityPostComposer";
import communityBackground from "@/app/images/community/community2.jpg";
import { readCommunityProfileSettings } from "@/lib/community-profile";
import { clearDemoSession, readStoredUser } from "@/lib/rbac";

type DbCommunityReply = {
    _id: string;
    postId: string;
    authorDisplayName?: string;
    message: string;
    createdAt?: string;
    isAccepted?: boolean;
};

type DbCommunityPost = {
    _id: string;
    title: string;
    description: string;
    category: "lost_item" | "study_material" | "academic_question";
    status?: "open" | "resolved" | "archived";
    createdAt?: string;
    likesCount?: number;
    repliesCount?: number;
    replies?: DbCommunityReply[];
};

const PROFILE_FALLBACK = {
    reputation: 1250,
    joined: "Aug 2024",
    about: "Passionate about helping classmates with coursework, project planning, and campus life tips.",
    rank: 18,
    profileViews: 532,
    streakDays: 23,
    stats: {
        posts: 42,
        replies: 156,
        helpful: 89,
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

    const profileData = useMemo(() => {
        const storedUser = readStoredUser();
        const settings = readCommunityProfileSettings();

        return {
            ...PROFILE_FALLBACK,
            name: settings.displayName || storedUser?.name || storedUser?.username || "Current User",
            role: roleToCommunityLabel(storedUser?.role),
            about: settings.bio || PROFILE_FALLBACK.about,
            username: settings.username || storedUser?.username || "-",
            email: settings.email || storedUser?.email || "-",
            faculty: settings.faculty,
            studyYear: settings.studyYear,
            userId: storedUser?.id || "",
        };
    }, []);

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

    const filteredRecentReplies = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return profileData.recentReplies;
        return profileData.recentReplies.filter(
            (r) =>
                r.postTitle.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)
        );
    }, [profileData.recentReplies, searchQuery]);

    const handleLogout = () => {
        clearDemoSession();
        setIsProfileMenuOpen(false);
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

    /** Only collapse the drawer on small screens; desktop sidebar stays open unless the user uses the menu button. */
    const closeSidebarIfMobile = useCallback(() => {
        if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
            setSidebarOpen(false);
        }
    }, []);

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
                            onClick={handleLogout}
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-200"
                        >
                            
                            <LogOut size={18} /> Logout
                            </button>
                        
                            
                           
                        </nav>
                    </aside>

                    <section className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
                        <div id="Profile details" className="rounded-2xl border border-blue-200 bg-slate-50/90 p-4 shadow-shadow sm:rounded-3xl md:p-5 lg:p-6">
                            <div className="space-y-5">
                    <div className="rounded-3xl border border-blue-100 bg-gradient-to-r from-white to-blue-50 p-6 md:p-7">
                        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
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
                            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-blue-100 bg-white/90 p-3">
                                <div className="rounded-xl bg-blue-50 p-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rank</p>
                                    <p className="mt-1 text-lg font-bold text-slate-800">#{profileData.rank}</p>
                                </div>
                                <div className="rounded-xl bg-blue-50 p-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Views</p>
                                    <p className="mt-1 text-lg font-bold text-slate-800">{profileData.profileViews}</p>
                                </div>
                                <div className="col-span-2 rounded-xl bg-blue-700 p-3 text-white">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">Current Streak</p>
                                    <p className="mt-1 flex items-center gap-2 text-lg font-bold">
                                        <Flame size={17} /> {profileData.streakDays} days active
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                        <Card className="rounded-2xl border border-blue-100 bg-white p-4 shadow-none">
                            <p className="mb-2 inline-flex rounded-lg bg-yellow-100 p-2 text-yellow-700">
                                <Star size={16} />
                            </p>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reputation</p>
                            <p className="mt-1 text-2xl font-bold text-slate-800">{profileData.reputation}</p>
                        </Card>
                        <Card className="rounded-2xl border border-blue-100 bg-white p-4 shadow-none">
                            <p className="mb-2 inline-flex rounded-lg bg-blue-100 p-2 text-blue-700">
                                <FileText size={16} />
                            </p>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Posts</p>
                            <p className="mt-1 text-2xl font-bold text-slate-800">{profileData.stats.posts}</p>
                        </Card>
                        <Card className="rounded-2xl border border-blue-100 bg-white p-4 shadow-none">
                            <p className="mb-2 inline-flex rounded-lg bg-cyan-100 p-2 text-cyan-700">
                                <MessageSquare size={16} />
                            </p>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Replies</p>
                            <p className="mt-1 text-2xl font-bold text-slate-800">{profileData.stats.replies}</p>
                        </Card>
                        <Card className="rounded-2xl border border-blue-100 bg-white p-4 shadow-none">
                            <p className="mb-2 inline-flex rounded-lg bg-green-100 p-2 text-green-700">
                                <ThumbsUp size={16} />
                            </p>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Helpful Votes</p>
                            <p className="mt-1 text-2xl font-bold text-slate-800">{profileData.stats.helpful}</p>
                        </Card>
                    </div>

                   

                    <div id="create-post" className="mt-10 scroll-mt-6">
                        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
                            <CirclePlus size={20} className="text-blue-700" /> Create post
                        </h2>
                        <p className="mb-4 text-sm text-slate-600">
                            Use the same composer as the full create page. Save draft, then post — you will be taken to the community feed when it succeeds.
                        </p>
                        <CommunityPostComposer compact className="shadow-shadow" />
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
                                                                <p className="mt-1 whitespace-pre-wrap">
                                                                    {reply.message}
                                                                </p>
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
                                                            <p className="mt-1 whitespace-pre-wrap">
                                                                {reply.message}
                                                            </p>
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
                        <Card className="rounded-2xl border border-dashed border-blue-200 bg-white/90 p-6 shadow-none">
                            <p className="text-sm text-slate-600">
                                Use <strong>Save draft</strong> in the create section above before posting. A list of saved drafts will show here when draft storage is connected to your account.
                            </p>
                            <a
                                href="#create-post"
                                className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
                            >
                                <CirclePlus size={16} />
                                Go to composer
                            </a>
                        </Card>
                    </div>

                    <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-100/60 p-4 text-sm text-blue-900">
                        Keep helping others, and your mentor badge progression will update automatically based on community contributions.
                    </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    BookOpen,
    ChevronDown,
    ChevronUp,
    CirclePlus,
    Clock,
    Flame,
    FileText,
    Home,
    Menu,
    MessageSquare,
    Paperclip,
    Search,
    Send,
    Settings,
    ThumbsUp,
    User,
    Users,
    X,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import CommunityReplyAttachment from "@/components/community/CommunityReplyAttachment";
import UrgentPostsCarousel from "@/components/community/UrgentPostsCarousel";
import CommunityInstructionsPanel from "@/components/community/CommunityInstructionsPanel";
import CommunitySidebarCalendar from "@/components/community/CommunitySidebarCalendar";
import { readStoredUser } from "@/lib/rbac";
import { readCommunityProfileSettings } from "@/lib/community-profile";
import {
    COMMUNITY_POST_REPORT_REASONS,
    type CommunityPostReportReasonKey,
} from "@/lib/community-post-report-reasons";

type Reply = {
    id: string;
    author: string;
    content: string;
    createdAt: string;
    likes: number;
    likedByCurrentUser: boolean;
    attachmentUrl?: string;
    attachmentName?: string;
};

type Post = {
    id: string;
    title: string;
    content: string;
    pictureUrl?: string;
    author: string;
    category: "lost_item" | "study_material" | "academic_question";
    createdAt: string;
    likes: number;
    likedByCurrentUser: boolean;
    reportedByCurrentUser: boolean;
    replies: Reply[];
    isUrgent?: boolean;
    urgentExpiresAt?: string | null;
    urgentLevel?: "2days" | "5days" | "7days" | null;
};

type ApiPost = {
    _id: string;
    title: string;
    description: string;
    pictureUrl?: string | null;
    category: "lost_item" | "study_material" | "academic_question";
    createdAt?: string;
    authorDisplayName?: string;
    author?: string | { username?: string; name?: string };
    likesCount?: number;
    likedByCurrentUser?: boolean;
    reportedByCurrentUser?: boolean;
    isUrgent?: boolean;
    urgentExpiresAt?: string | null;
    urgentLevel?: "2days" | "5days" | "7days" | null;
};

type ApiReply = {
    _id: string;
    postId: string;
    authorDisplayName?: string;
    author?: string | { username?: string; name?: string };
    message: string;
    createdAt?: string;
    likesCount?: number;
    likedByCurrentUser?: boolean;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
};

const isActiveUrgentPost = (post: Pick<Post, "isUrgent" | "urgentExpiresAt">): boolean => {
    if (!post.isUrgent) return false;
    const raw = post.urgentExpiresAt;
    if (raw == null || String(raw).trim() === "") return true;
    const exp = new Date(raw).getTime();
    if (Number.isNaN(exp)) return true;
    return exp > Date.now();
};

const toTimeAgo = (createdAt?: string): string => {
    if (!createdAt) return "Just now";
    const createdMs = new Date(createdAt).getTime();
    if (Number.isNaN(createdMs)) return "Just now";

    const diffMs = Date.now() - createdMs;
    const minutes = Math.max(1, Math.floor(diffMs / 60000));
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
};

const mapApiReply = (reply: ApiReply): Reply => ({
    id: reply._id,
    author:
        reply.authorDisplayName ||
        (typeof reply.author === "object"
            ? reply.author.name || "Current User"
            : "Current User"),
    content: reply.message,
    createdAt: toTimeAgo(reply.createdAt),
    likes: Number(reply.likesCount ?? 0),
    likedByCurrentUser: Boolean(reply.likedByCurrentUser),
    attachmentUrl: reply.attachmentUrl?.trim() || undefined,
    attachmentName: reply.attachmentName?.trim() || undefined,
});

const MAX_REPLY_ATTACHMENT_FILE_BYTES = 1_850_000;

function readReplyAttachmentFile(file: File): Promise<{ dataUrl: string; name: string }> {
    return new Promise((resolve, reject) => {
        if (file.size > MAX_REPLY_ATTACHMENT_FILE_BYTES) {
            reject(new Error("Attachment is too large (max ~1.8 MB)."));
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const r = reader.result;
            if (typeof r !== "string") {
                reject(new Error("Could not read file."));
                return;
            }
            resolve({ dataUrl: r, name: file.name });
        };
        reader.onerror = () => reject(new Error("Could not read file."));
        reader.readAsDataURL(file);
    });
}

const CATEGORIES = ["all", "urgent", "lost_item", "study_material", "academic_question"] as const;

const INITIAL_POSTS: Post[] = [
    {
        id: "1",
        title: "Best resources for learning Next.js 14?",
        content:
            "Hey everyone! I'm starting to learn Next.js 14 App Router. Does anyone have good recommendations for courses or reading material?",
        author: "Alex Johnson",
        category: "academic_question",
        createdAt: "2 hours ago",
        likes: 12,
        likedByCurrentUser: false,
        reportedByCurrentUser: false,
        replies: [
            {
                id: "r1",
                author: "Sarah Smith",
                content: "I recommend the official Next.js documentation, it is really comprehensive and includes a great tutorial!",
                createdAt: "1 hour ago",
                likes: 0,
                likedByCurrentUser: false,
            },
        ],
    },
    {
        id: "2",
        title: "Campus Hackathon this Weekend!",
        content:
            "Don't forget that the annual campus hackathon is happening this weekend at the main library. Registration is still open until Friday. Free pizza!",
        author: "Tech Club",
        category: "study_material",
        createdAt: "5 hours ago",
        likes: 45,
        likedByCurrentUser: false,
        reportedByCurrentUser: false,
        replies: [],
    },
    {
        id: "3",
        title: "Study group for Data Structures",
        content: "Looking for 2-3 people to join our study group for the upcoming Data Structures midterm. We meet Tuesdays and Thursdays.",
        author: "Michael Lee",
        category: "lost_item",
        createdAt: "1 day ago",
        likes: 8,
        likedByCurrentUser: false,
        reportedByCurrentUser: false,
        replies: [
            {
                id: "r2",
                author: "Emma Davis",
                content: "I'm interested! What time do you usually meet?",
                createdAt: "12 hours ago",
                likes: 0,
                likedByCurrentUser: false,
            },
        ],
    },
];

const MOCK_MEMBERS = [
    { id: "1", name: "Sam Jenkins", role: "Core Team" },
    { id: "2", name: "Priya Singh", role: "Verified Mentor" },
    { id: "3", name: "IT23123456", role: "Contributor" },
    { id: "4", name: "Nimal Perera", role: "Contributor" },
];

const categoryLabel: Record<(typeof CATEGORIES)[number], string> = {
    all: "All",
    urgent: "🔥 Urgent",
    lost_item: "🎒 Lost Items",
    study_material: "📂 Study Materials",
    academic_question: "📘 Academic",
};

const postCardLeftAccent: Record<Post["category"], string> = {
    academic_question: "border-l-blue-600",
    lost_item: "border-l-orange-500",
    study_material: "border-l-emerald-600",
};

const categoryChipStyles: Record<(typeof CATEGORIES)[number], { active: string; inactive: string }> = {
    all: {
        active: "bg-slate-700 text-white",
        inactive: "bg-slate-200 text-slate-700 hover:bg-slate-300",
    },
    urgent: {
        active: "bg-amber-600 text-white",
        inactive: "bg-amber-100 text-amber-900 hover:bg-amber-200",
    },
    academic_question: {
        active: "bg-blue-600 text-white",
        inactive: "bg-blue-100 text-blue-900 hover:bg-blue-200",
    },
    lost_item: {
        active: "bg-orange-500 text-white",
        inactive: "bg-orange-100 text-orange-900 hover:bg-orange-200",
    },
    study_material: {
        active: "bg-emerald-600 text-white",
        inactive: "bg-emerald-100 text-emerald-900 hover:bg-emerald-200",
    },
};

const categoryEmoji: Record<Post["category"], string> = {
    academic_question: "📘",
    lost_item: "🎒",
    study_material: "📂",
};

export default function CommunityPage() {
    const router = useRouter();
    const currentUser = useMemo(() => readStoredUser(), []);
    const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
    const [activeCategory, setActiveCategory] = useState<(typeof CATEGORIES)[number]>("all");
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isMembersVisible, setIsMembersVisible] = useState(false);
    const [isRecentVisible, setIsRecentVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [titleSearch, setTitleSearch] = useState("");
    const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
    const [newReplyContent, setNewReplyContent] = useState("");
    const [newReplyAttachment, setNewReplyAttachment] = useState<{ dataUrl: string; name: string } | null>(
        null
    );
    const [actionError, setActionError] = useState("");
    const [reportDialogPostId, setReportDialogPostId] = useState<string | null>(null);
    const [reportSelectedReason, setReportSelectedReason] =
        useState<CommunityPostReportReasonKey>("spam");
    const [reportOtherText, setReportOtherText] = useState("");
    const [reportDialogError, setReportDialogError] = useState("");
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
    const recentPosts = useMemo(() => posts.slice(0, 5), [posts]);
    const urgentPostsActive = useMemo(
        () => posts.filter(isActiveUrgentPost).slice(0, 10),
        [posts]
    );

    const urgentCarouselPosts = useMemo(
        () =>
            urgentPostsActive.map((post) => {
                const expiry =
                    post.urgentExpiresAt && !Number.isNaN(new Date(post.urgentExpiresAt).getTime())
                        ? `Until ${new Date(post.urgentExpiresAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                          })}`
                        : null;
                const stripped = post.content.trim();
                const description =
                    stripped.length > 110
                        ? `${stripped.slice(0, 110).trim()}…`
                        : stripped || "Open the post to read more.";
                return {
                    id: post.id,
                    title: post.title,
                    description,
                    metaLine: [post.createdAt, expiry].filter(Boolean).join(" · "),
                };
            }),
        [urgentPostsActive]
    );

    const filteredPosts = useMemo(() => {
        const byCategory = posts.filter((post) => {
            if (activeCategory === "all") return true;
            if (activeCategory === "urgent") return isActiveUrgentPost(post);
            return post.category === activeCategory;
        });
        const titleQuery = titleSearch.trim().toLowerCase();
        const byTitle =
            titleQuery.length === 0
                ? byCategory
                : byCategory.filter(
                    // Title-only search filter (requested)
                    (post) => post.title.toLowerCase().includes(titleQuery)
                );

        const query = searchQuery.trim().toLowerCase();
        if (!query) return byTitle;
        return byTitle.filter((post) =>
            `${post.title} ${post.content} ${post.author} ${post.category}`.toLowerCase().includes(query)
        );
    }, [activeCategory, posts, searchQuery, titleSearch]);

    const loadRepliesForPost = async (postId: string) => {
        try {
            const params = new URLSearchParams({ postId });
            if (currentUser?.id) {
                params.set("viewerId", currentUser.id);
            }
            const res = await fetch(`/api/community-replies?${params.toString()}`);
            if (!res.ok) return;
            const data = (await res.json()) as ApiReply[];
            const mappedReplies = data.map(mapApiReply);

            setPosts((prevPosts) =>
                prevPosts.map((post) => (post.id === postId ? { ...post, replies: mappedReplies } : post))
            );
        } catch {
            // Keep existing replies if DB read fails.
        }
    };

    const handleJumpToPost = (postId: string) => {
        setExpandedPostId(postId);
        setNewReplyContent("");
        void loadRepliesForPost(postId);
        const el = document.getElementById(`post-${postId}`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    //filter posts by category

    useEffect(() => {
        const mapCategory = (category: ApiPost["category"]): Post["category"] => {
            if (category === "academic_question") return "academic_question";
            if (category === "study_material") return "study_material";
            return "lost_item";
        };

        const fetchPosts = async () => {
            try {
                const params = new URLSearchParams();
                if (currentUser?.id) {
                    params.set("viewerId", currentUser.id);
                }
                const query = params.toString();
                const res = await fetch(query ? `/api/community-posts?${query}` : "/api/community-posts");
                if (!res.ok) return;

                const data = (await res.json()) as ApiPost[];
                const mapped: Post[] = data.map((post) => ({
                    id: post._id,
                    title: post.title,
                    content: post.description,
                    pictureUrl: post.pictureUrl?.trim() || undefined,
                    author:
                        post.authorDisplayName ||
                        (typeof post.author === "object"
                            ? post.author.name || "Current User"
                            : "Current User"),
                    category: mapCategory(post.category),
                    createdAt: toTimeAgo(post.createdAt),
                    likes: Number(post.likesCount ?? 0),
                    likedByCurrentUser: Boolean(post.likedByCurrentUser),
                    reportedByCurrentUser: Boolean(post.reportedByCurrentUser),
                    replies: [],
                    isUrgent: Boolean(post.isUrgent),
                    urgentExpiresAt:
                        post.urgentExpiresAt != null && String(post.urgentExpiresAt).length > 0
                            ? String(post.urgentExpiresAt)
                            : null,
                    urgentLevel:
                        post.urgentLevel === "2days" ||
                        post.urgentLevel === "5days" ||
                        post.urgentLevel === "7days"
                            ? post.urgentLevel
                            : null,
                }));

                setPosts(mapped);

                const repliesPerPost = await Promise.all(
                    mapped.map(async (post) => {
                        try {
                            const replyParams = new URLSearchParams({ postId: post.id });
                            if (currentUser?.id) {
                                replyParams.set("viewerId", currentUser.id);
                            }
                            const replyRes = await fetch(`/api/community-replies?${replyParams.toString()}`);
                            if (!replyRes.ok) return [post.id, [] as Reply[]] as const;
                            const replyData = (await replyRes.json()) as ApiReply[];
                            return [post.id, replyData.map(mapApiReply)] as const;
                        } catch {
                            return [post.id, [] as Reply[]] as const;
                        }
                    })
                );

                const repliesByPostId = new Map<string, Reply[]>(repliesPerPost);
                setPosts((prevPosts) =>
                    prevPosts.map((post) => ({
                        ...post,
                        replies: repliesByPostId.get(post.id) ?? post.replies,
                    }))
                );
            } catch {
                // Keep fallback mock posts if DB read fails.
            }
        };

        fetchPosts();
    }, [currentUser?.id]);

    const handleLikePost = async (postId: string) => {
        if (!currentUser?.id) {
            setActionError("Please login to like posts.");
            return;
        }
        setActionError("");
        try {
            const res = await fetch("/api/community-post-likes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    postId,
                    userId: currentUser.id,
                    username: currentUser.username,
                    email: currentUser.email,
                    name: currentUser.name,
                }),
            });
            const payload = (await res.json().catch(() => null)) as
                | { liked?: boolean; likesCount?: number; error?: string }
                | null;
            if (!res.ok) {
                setActionError(payload?.error ?? "Failed to update post like.");
                return;
            }

            setPosts((prevPosts) =>
                prevPosts.map((post) =>
                    post.id === postId
                        ? {
                            ...post,
                            likedByCurrentUser: Boolean(payload?.liked),
                            likes: Number(payload?.likesCount ?? post.likes),
                        }
                        : post
                )
            );
        } catch {
            setActionError("Unable to update post like right now.");
        }
    };

    const handleLikeReply = async (postId: string, replyId: string) => {
        if (!currentUser?.id) {
            setActionError("Please login to like replies.");
            return;
        }
        setActionError("");
        try {
            const res = await fetch("/api/community-reply-likes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    replyId,
                    userId: currentUser.id,
                    username: currentUser.username,
                    email: currentUser.email,
                    name: currentUser.name,
                }),
            });
            const payload = (await res.json().catch(() => null)) as
                | { liked?: boolean; likesCount?: number; error?: string }
                | null;
            if (!res.ok) {
                setActionError(payload?.error ?? "Failed to update reply like.");
                return;
            }

            setPosts((prevPosts) =>
                prevPosts.map((post) =>
                    post.id === postId
                        ? {
                            ...post,
                            replies: post.replies.map((reply) =>
                                reply.id === replyId
                                    ? {
                                        ...reply,
                                        likedByCurrentUser: Boolean(payload?.liked),
                                        likes: Number(payload?.likesCount ?? reply.likes),
                                    }
                                    : reply
                            ),
                        }
                        : post
                )
            );
        } catch {
            setActionError("Unable to update reply like right now.");
        }
    };

    const openReportDialog = (postId: string) => {
        if (!currentUser?.id) {
            setActionError("Please login to report posts.");
            return;
        }
        setActionError("");
        setReportDialogPostId(postId);
        setReportSelectedReason("spam");
        setReportOtherText("");
        setReportDialogError("");
    };

    const closeReportDialog = () => {
        if (reportSubmitting) return;
        setReportDialogPostId(null);
        setReportDialogError("");
    };

    const submitPostReport = async () => {
        if (!reportDialogPostId || !currentUser?.id) return;

        if (reportSelectedReason === "other" && !reportOtherText.trim()) {
            setReportDialogError("Please describe what is wrong.");
            return;
        }

        setReportDialogError("");
        setReportSubmitting(true);
        setActionError("");

        try {
            const res = await fetch("/api/community-post-reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    postId: reportDialogPostId,
                    userId: currentUser.id,
                    username: currentUser.username,
                    email: currentUser.email,
                    name: currentUser.name,
                    reasonKey: reportSelectedReason,
                    ...(reportSelectedReason === "other"
                        ? { details: reportOtherText.trim() }
                        : {}),
                }),
            });
            const payload = (await res.json().catch(() => null)) as { error?: string } | null;
            if (!res.ok) {
                setActionError(payload?.error ?? "Failed to report post.");
                setReportSubmitting(false);
                return;
            }

            const reportedId = reportDialogPostId;
            setReportDialogPostId(null);
            setPosts((prevPosts) =>
                prevPosts.map((post) =>
                    post.id === reportedId ? { ...post, reportedByCurrentUser: true } : post
                )
            );
        } catch {
            setActionError("Unable to report this post right now.");
        } finally {
            setReportSubmitting(false);
        }
    };

    const handleReplySubmit = async (e: React.FormEvent, postId: string) => {
        e.preventDefault();
        if (!newReplyContent.trim() && !newReplyAttachment) {
            setActionError("Add a message or attach a file.");
            return;
        }

        if (!currentUser?.id) {
            setActionError("Please login to reply.");
            return;
        }

        const message = newReplyContent.trim();
        const settings = readCommunityProfileSettings();
        const authorDisplayName =
            settings.displayName.trim() || currentUser?.name?.trim() || "Current User";
        setActionError("");

        try {
            const res = await fetch("/api/community-replies", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    postId,
                    message,
                    author: currentUser.id,
                    authorUsername: currentUser.username,
                    authorEmail: currentUser.email,
                    // keep server fallback in sync with display name
                    authorName: authorDisplayName,
                    authorDisplayName,
                    ...(newReplyAttachment
                        ? {
                              attachmentUrl: newReplyAttachment.dataUrl,
                              attachmentName: newReplyAttachment.name,
                          }
                        : {}),
                }),
            });
            if (!res.ok) {
                const payload = (await res.json().catch(() => null)) as { error?: string } | null;
                setActionError(payload?.error ?? "Failed to add reply.");
                return;
            }

            const createdReply = (await res.json()) as ApiReply;
            const mappedReply = mapApiReply(createdReply);

            setPosts((prevPosts) =>
                prevPosts.map((post) => (post.id === postId ? { ...post, replies: [mappedReply, ...post.replies] } : post))
            );
            setNewReplyContent("");
            setNewReplyAttachment(null);
        } catch {
            setActionError("Unable to submit reply right now.");
        }
    };

    const toggleReplySection = (postId: string) => {
        if (expandedPostId === postId) {
            setExpandedPostId(null);
            setNewReplyAttachment(null);
            return;
        }
        setExpandedPostId(postId);
        setNewReplyContent("");
        setNewReplyAttachment(null);
        void loadRepliesForPost(postId);
    };

    const handleBackToStudentPage = () => {
        setIsProfileMenuOpen(false);
        router.push("/student");
    };

    return (
        <main className="relative h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-sky-50 to-blue-50 text-[#0f0f0f]">
            <div className="relative h-full">
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
                            <span className="text-lg font-bold tracking-tight text-slate-800">Community</span>
                        </div>
                    </div>
{/*search bar  */ }
                    <div className="hidden w-full max-w-2xl items-center gap-2 md:flex">
                        <div className="flex h-10 flex-1 items-center rounded-full border border-blue-200 bg-white/90 px-4">
                            <Search size={18} className="text-slate-500" />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search community post's title"
                                className="ml-3 w-full bg-transparent text-sm text-slate-700 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <Link
                            href="/community/profile/#create-post"
                            className="inline-flex h-10 items-center gap-2 rounded-full bg-blue-100 px-3 text-sm font-semibold text-blue-800 hover:bg-blue-200 sm:px-4"
                        >
                            <CirclePlus size={18} />
                            <span className="hidden sm:inline">Create</span>
                        </Link>
                        {/*
                        <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-blue-100">
                            <Bell size={20} />
                        </button> */}

                        <div className="relative">
                            <button
                                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-700 text-white"
                            >
                                <User size={18} />
                            </button>

                            {isProfileMenuOpen && (
                                <>
                                    <button
                                        type="button"
                                        className="fixed inset-0 z-40"
                                        onClick={() => setIsProfileMenuOpen(false)}
                                        aria-label="Close profile menu"
                                    />
                                    <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-blue-100 bg-white p-2 shadow-lg">
                                        <Link
                                            href="/community/profile"
                                            onClick={() => setIsProfileMenuOpen(false)}
                                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-blue-50"
                                        >
                                            <User size={16} /> Profile
                                        </Link>
                                        <Link
                                            href="/community/Settings"
                                            onClick={() => setIsProfileMenuOpen(false)}
                                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-blue-50"
                                        >
                                            <Settings size={16} /> Settings
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={handleBackToStudentPage}
                                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-blue-50"
                                        >
                                            <ArrowLeft size={16} /> Back to student page
                                        </button>
                                    </div>
                                </>
                            )}
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
                    <div className="flex h-full flex-col">
                        <div className="space-y-1">
                            <Link href="/community" className="flex items-center gap-3 rounded-xl bg-blue-800 px-3 py-2.5 text-sm font-semibold text-white">
                                <Home size={18} /> Home
                            </Link>
                            <Link href="/community/profile" className="flex items-center gap-3 rounded-xl bg-blue-100 px-3 py-2.5 text-sm font-semibold text-blue-900 hover:bg-blue-900 hover:text-white">
                                <User size={18} /> Profile
                            </Link>
                            
                        </div>

                        <div className="my-3 h-px bg-blue-100" />

                        <div className="flex-1 space-y-3 overflow-y-auto pr-1">

                        <div className="rounded-xl border border-amber-200/80 bg-white/95 p-3">
                            <div className="flex w-full items-center text-sm font-semibold text-slate-700">
                                <span className="flex items-center gap-2">
                                    <Flame size={16} className="text-amber-600" aria-hidden />
                                    Urgent posts
                                    {urgentPostsActive.length > 0 ? (
                                        <span className="rounded-full bg-amber-100 px-1.5 py-0 text-[10px] font-bold text-amber-800">
                                            {urgentPostsActive.length}
                                        </span>
                                    ) : null}
                                </span>
                            </div>
                            <div className="mt-3 pr-1">
                                {urgentPostsActive.length === 0 ? (
                                    <p className="text-xs text-slate-500">No active urgent posts right now.</p>
                                ) : (
                                    <UrgentPostsCarousel
                                        posts={urgentCarouselPosts}
                                        baseWidth={252}
                                        autoplay
                                        autoplayDelay={3800}
                                        pauseOnHover
                                        loop={urgentCarouselPosts.length > 1}
                                        onSelectPost={handleJumpToPost}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-blue-100 bg-white/95 p-3">
                            <button
                                type="button"
                                onClick={() => setIsMembersVisible((prev) => !prev)}
                                className="flex w-full items-center justify-between text-sm font-semibold text-slate-700"
                            >
                                <span className="flex items-center gap-2">
                                    <Users size={16} /> Members Details
                                </span>
                                {isMembersVisible ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            {isMembersVisible && (
                                <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
                                    {MOCK_MEMBERS.map((member) => (
                                        <div key={member.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-blue-50">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                                                <User size={14} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium leading-none text-slate-800">{member.name}</p>
                                                <p className="mt-1 text-xs text-slate-500">{member.role}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        

                        <div className="rounded-xl border border-blue-100 bg-white/95 p-3">
                            <button
                                type="button"
                                onClick={() => setIsRecentVisible((prev) => !prev)}
                                className="flex w-full items-center justify-between text-sm font-semibold text-slate-700"
                            >
                                <span className="flex items-center gap-2">
                                    <Clock size={16} /> Recent Posts
                                </span>
                                {isRecentVisible ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            {isRecentVisible && (
                                <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
                                    
                                    {recentPosts.length === 0 ? (
                                        <p className="text-xs text-slate-500">No posts yet.</p>
                                    ) : (
                                        recentPosts.map((post) => (
                                            <button
                                                key={post.id}
                                                type="button"
                                                onClick={() => handleJumpToPost(post.id)}
                                                className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-blue-50"
                                            >
                                                <p className="text-sm font-semibold leading-snug text-slate-800 line-clamp-2">
                                                    {post.title}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">{post.createdAt}</p>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleBackToStudentPage}
                            className="mt-auto flex items-center gap-3 rounded-xl bg-red-100 px-3 py-2.5 text-sm font-semibold text-red-900 hover:bg-red-900 hover:text-white"
                        >
                            <ArrowLeft size={18} /> Back to student page
                        </button>
                    </div>
                </aside>

                <section className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
                    <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
                        {CATEGORIES.map((category) => {
                            const chip = categoryChipStyles[category];
                            return (
                                <button
                                    key={category}
                                    onClick={() => setActiveCategory(category)}
                                    className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${
                                        activeCategory === category ? chip.active : chip.inactive
                                    }`}
                                >
                                    {categoryLabel[category]}
                                </button>
                            );
                        })}
                    </div>
                    {actionError ? (
                        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {actionError}
                        </p>
                    ) : null}

                    {filteredPosts.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-blue-200 bg-white/95 p-10 text-center text-slate-500">
                            No matching posts found.
                        </div>
                    ) : (
                        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
                            {filteredPosts.map((post) => (
                                <Card
                                    key={post.id}
                                    id={`post-${post.id}`}
                                    className={`relative overflow-hidden rounded-2xl border border-blue-100 border-l-4 bg-blue-100 shadow-none ${postCardLeftAccent[post.category]}`}
                                >
                                    <span
                                        className="absolute right-3 top-3 text-2xl leading-none select-none"
                                        title={categoryLabel[post.category]}
                                    >
                                        {categoryEmoji[post.category]}
                                    </span>

                                    <div className="p-4 pr-12">
                                        <div className="flex gap-3">
                                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                                                <User size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="line-clamp-2 text-base font-semibold leading-snug text-slate-800">{post.title}</h3>
                                                <p className="mt-1 text-sm text-slate-600">{post.author}</p>
                                                <p className="text-xs text-slate-500">
                                                    {post.createdAt} • {post.replies.length} replies
                                                </p>
                                            </div>
                                        </div>

                                        <p className="mt-3 line-clamp-3 text-sm text-slate-700">{post.content}</p>
                                        {post.pictureUrl ? (
                                            <div className="mt-3 overflow-hidden rounded-xl border border-blue-100 bg-slate-50">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={post.pictureUrl}
                                                    alt=""
                                                    className="max-h-72 w-full object-contain"
                                                />
                                            </div>
                                        ) : null}

                                        <div className="mt-4 flex items-center gap-2 border-t border-blue-100 pt-3">
                                            <button
                                                onClick={() => handleLikePost(post.id)}
                                                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm hover:bg-blue-50 ${
                                                    post.likedByCurrentUser ? "text-blue-700" : "text-slate-700"
                                                }`}
                                            >
                                                <ThumbsUp size={16} /> {post.likes}
                                            </button>
                                            <button
                                                onClick={() => toggleReplySection(post.id)}
                                                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-slate-700 hover:bg-blue-50"
                                            >
                                                <MessageSquare size={16} /> Reply
                                            </button>
                                            <button
                                                onClick={() => openReportDialog(post.id)}
                                                disabled={post.reportedByCurrentUser}
                                                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-slate-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400"
                                            >
                                                {post.reportedByCurrentUser ? "Reported" : "Report"}
                                            </button>
                                        </div>
                                    </div>

                                    {expandedPostId === post.id && (
                                        <div className="border-t border-blue-100 bg-slate-50 p-4">
                                            <div className="space-y-3">
                                                {post.replies.length === 0 ? (
                                                    <p className="text-sm text-slate-500">No replies yet. Be the first to reply.</p>
                                                ) : (
                                                    post.replies.map((reply) => (
                                                        <div key={reply.id} className="rounded-xl border border-blue-100 bg-white p-3">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-sm font-semibold text-slate-800">{reply.author}</p>
                                                                <p className="text-xs text-slate-500">{reply.createdAt}</p>
                                                            </div>
                                                            {(reply.content ?? "").trim() ? (
                                                                <p className="mt-1 text-sm text-slate-700">{reply.content}</p>
                                                            ) : reply.attachmentUrl ? (
                                                                <p className="mt-1 text-xs italic text-slate-500">Attachment only</p>
                                                            ) : null}
                                                            {reply.attachmentUrl ? (
                                                                <CommunityReplyAttachment
                                                                    attachmentUrl={reply.attachmentUrl}
                                                                    attachmentName={reply.attachmentName}
                                                                />
                                                            ) : null}
                                                            <div className="mt-2 flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleLikeReply(post.id, reply.id)}
                                                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs hover:bg-blue-50 ${
                                                                        reply.likedByCurrentUser ? "text-blue-700" : "text-slate-600"
                                                                    }`}
                                                                >
                                                                    <ThumbsUp size={13} /> {reply.likes}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            <form onSubmit={(e) => handleReplySubmit(e, post.id)} className="mt-4">
                                                <Textarea
                                                    value={newReplyContent}
                                                    onChange={(e) => setNewReplyContent(e.target.value)}
                                                    placeholder="Write a reply… (optional if you attach a file)"
                                                    className="min-h-[90px] border-blue-200 bg-white text-sm"
                                                />
                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-blue-50">
                                                        <Paperclip size={14} aria-hidden />
                                                        Attach file
                                                        <input
                                                            type="file"
                                                            className="sr-only"
                                                            accept=".pdf,.doc,.docx,image/png,image/jpeg,image/gif,image/webp,.txt,text/plain"
                                                            onChange={async (e) => {
                                                                const f = e.target.files?.[0];
                                                                e.target.value = "";
                                                                if (!f) return;
                                                                setActionError("");
                                                                try {
                                                                    const att = await readReplyAttachmentFile(f);
                                                                    setNewReplyAttachment(att);
                                                                } catch (err) {
                                                                    setActionError(
                                                                        err instanceof Error
                                                                            ? err.message
                                                                            : "Could not attach file."
                                                                    );
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                    {newReplyAttachment ? (
                                                        <span className="flex max-w-full items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs text-slate-700">
                                                            <FileText size={12} className="shrink-0" aria-hidden />
                                                            <span className="truncate">{newReplyAttachment.name}</span>
                                                            <button
                                                                type="button"
                                                                className="ml-1 shrink-0 rounded px-1 text-slate-500 hover:bg-blue-100 hover:text-slate-800"
                                                                onClick={() => setNewReplyAttachment(null)}
                                                                aria-label="Remove attachment"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className="mt-3 flex justify-end">
                                                    <Button
                                                        type="submit"
                                                        variant="primary"
                                                        className="gap-2 bg-blue-700 hover:bg-blue-800"
                                                        disabled={!newReplyContent.trim() && !newReplyAttachment}
                                                    >
                                                        <Send size={14} /> Reply
                                                    </Button>
                                                </div>
                                            </form>
                                        </div>
                                    )}
                                </Card>
                            ))}
                        </div>
                    )}
                </section>

                <aside
                    id="community-instructions"
                    className="hidden shrink-0 border-l border-blue-100 bg-slate-100/95 lg:sticky lg:top-16 lg:flex lg:h-[calc(100vh-4rem)] lg:w-80 lg:flex-col lg:gap-3 lg:overflow-y-auto lg:self-start lg:p-4"
                    aria-label="Instructions and calendar"
                >
                    <CommunityInstructionsPanel className="rounded-xl border border-blue-100 bg-white/95 p-4 shadow-sm" />
                    <CommunitySidebarCalendar />
                </aside>
            </div>
            </div>

            {isInstructionsOpen ? (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-[62] bg-black/40 lg:hidden"
                        aria-label="Close instructions"
                        onClick={() => setIsInstructionsOpen(false)}
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="community-instructions-title"
                        className="fixed left-1/2 top-1/2 z-[72] w-[min(100%,26rem)] max-h-[min(90vh,40rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-blue-100 bg-white p-5 shadow-xl lg:hidden"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <h2 id="community-instructions-title" className="sr-only">
                                Community instructions
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsInstructionsOpen(false)}
                                className="ml-auto rounded-full p-1 text-slate-500 hover:bg-blue-50"
                                aria-label="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <CommunityInstructionsPanel
                            className="-mt-2"
                            onFinish={() => setIsInstructionsOpen(false)}
                        />
                    </div>
                </>
            ) : null}

            {reportDialogPostId ? (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-[60] bg-black/40"
                        aria-label="Close report dialog"
                        onClick={closeReportDialog}
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="report-post-title"
                        className="fixed left-1/2 top-1/2 z-[70] w-[min(100%,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-blue-100 bg-white p-5 shadow-xl"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <h2 id="report-post-title" className="text-base font-semibold text-slate-800">
                                Report this post
                            </h2>
                            <button
                                type="button"
                                onClick={closeReportDialog}
                                disabled={reportSubmitting}
                                className="rounded-full p-1 text-slate-500 hover:bg-blue-50 disabled:opacity-50"
                                aria-label="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                            Why are you reporting this? Moderators will review your report.
                        </p>

                        <fieldset className="mt-4 space-y-2">
                            <legend className="sr-only">Report reason</legend>
                            {COMMUNITY_POST_REPORT_REASONS.map((option) => (
                                <label
                                    key={option.key}
                                    className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                                        reportSelectedReason === option.key
                                            ? "border-blue-500 bg-blue-50"
                                            : "border-blue-100 hover:bg-slate-50"
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="report-reason"
                                        className="mt-1"
                                        checked={reportSelectedReason === option.key}
                                        onChange={() => {
                                            setReportSelectedReason(option.key);
                                            setReportDialogError("");
                                        }}
                                    />
                                    <span className="text-slate-800">{option.label}</span>
                                </label>
                            ))}
                        </fieldset>

                        {reportSelectedReason === "other" ? (
                            <div className="mt-3">
                                <label htmlFor="report-other-details" className="text-xs font-medium text-slate-600">
                                    Please explain
                                </label>
                                <Textarea
                                    id="report-other-details"
                                    value={reportOtherText}
                                    onChange={(e) => {
                                        setReportOtherText(e.target.value);
                                        setReportDialogError("");
                                    }}
                                    placeholder="Describe the issue…"
                                    className="mt-1 min-h-[88px] border-blue-200 bg-white text-sm"
                                />
                            </div>
                        ) : null}

                        {reportDialogError ? (
                            <p className="mt-3 text-sm text-red-600">{reportDialogError}</p>
                        ) : null}

                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeReportDialog}
                                disabled={reportSubmitting}
                                className="rounded-full border border-blue-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-blue-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void submitPostReport()}
                                disabled={reportSubmitting}
                                className="rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                            >
                                {reportSubmitting ? "Submitting…" : "Submit report"}
                            </button>
                        </div>
                    </div>
                </>
            ) : null}
        </main>
    );
}



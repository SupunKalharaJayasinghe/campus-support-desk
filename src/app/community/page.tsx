"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Bell,
    ChevronDown,
    ChevronUp,
    CirclePlus,
    Clock,
    Home,
    LogOut,
    Menu,
    MessageSquare,
    Search,
    Send,
    Settings,
    Share2,
    ThumbsUp,
    User,
    Users,
    X,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { clearDemoSession, readStoredUser } from "@/lib/rbac";
import communityBackground from "@/app/images/community/community2.jpg";

type Reply = {
    id: string;
    author: string;
    content: string;
    createdAt: string;
};

type Post = {
    id: string;
    title: string;
    content: string;
    author: string;
    category: "lost_item" | "study_material" | "academic_question";
    createdAt: string;
    likes: number;
    replies: Reply[];
};

type ApiPost = {
    _id: string;
    title: string;
    description: string;
    category: "lost_item" | "study_material" | "academic_question";
    createdAt?: string;
    author?: string | { name?: string };
};

type ApiReply = {
    _id: string;
    postId: string;
    author?: string | { name?: string };
    message: string;
    createdAt?: string;
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
    author: typeof reply.author === "object" && reply.author?.name ? reply.author.name : "Current User",
    content: reply.message,
    createdAt: toTimeAgo(reply.createdAt),
});

const CATEGORIES = ["all", "lost_item", "study_material", "academic_question"] as const;

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
        replies: [
            {
                id: "r1",
                author: "Sarah Smith",
                content: "I recommend the official Next.js documentation, it is really comprehensive and includes a great tutorial!",
                createdAt: "1 hour ago",
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
        replies: [
            {
                id: "r2",
                author: "Emma Davis",
                content: "I'm interested! What time do you usually meet?",
                createdAt: "12 hours ago",
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

const RECENT_ACTIVITY = [
    { id: "a1", content: 'New event: "Hackathon Prep"', time: "14 days ago" },
    { id: "a2", content: 'Discussion created: "Career Pathways"', time: "10 days ago" },
    { id: "a3", content: 'Resource uploaded for "Data Structures"', time: "7 days ago" },
];

const categoryLabel: Record<(typeof CATEGORIES)[number], string> = {
    all: "All",
    lost_item: "Lost Items",
    study_material: "Study Material",
    academic_question: "Academic Questions",
};

const thumbnailStyle: Record<Post["category"], string> = {
    lost_item: "from-slate-500/85 to-blue-700/85",
    study_material: "from-blue-500/85 to-slate-700/85",
    academic_question: "from-blue-400/85 to-indigo-700/85",
};

export default function CommunityPage() {
    const router = useRouter();
    const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
    const [activeCategory, setActiveCategory] = useState<(typeof CATEGORIES)[number]>("all");
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isMembersVisible, setIsMembersVisible] = useState(true);
    const [isRecentVisible, setIsRecentVisible] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
    const [newReplyContent, setNewReplyContent] = useState("");

    const filteredPosts = useMemo(() => {
        const byCategory = posts.filter((post) => activeCategory === "all" || post.category === activeCategory);
        const query = searchQuery.trim().toLowerCase();
        if (!query) return byCategory;
        return byCategory.filter((post) =>
            `${post.title} ${post.content} ${post.author} ${post.category}`.toLowerCase().includes(query)
        );
    }, [activeCategory, posts, searchQuery]);

    const loadRepliesForPost = async (postId: string) => {
        try {
            const res = await fetch(`/api/community-replies?postId=${encodeURIComponent(postId)}`);
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

    useEffect(() => {
        const mapCategory = (category: ApiPost["category"]): Post["category"] => {
            if (category === "academic_question") return "academic_question";
            if (category === "study_material") return "study_material";
            return "lost_item";
        };

        const fetchPosts = async () => {
            try {
                const res = await fetch("/api/community-posts");
                if (!res.ok) return;

                const data = (await res.json()) as ApiPost[];
                const mapped: Post[] = data.map((post) => ({
                    id: post._id,
                    title: post.title,
                    content: post.description,
                    author: typeof post.author === "object" && post.author?.name ? post.author.name : "Current User",
                    category: mapCategory(post.category),
                    createdAt: toTimeAgo(post.createdAt),
                    likes: 0,
                    replies: [],
                }));

                setPosts(mapped);

                const repliesPerPost = await Promise.all(
                    mapped.map(async (post) => {
                        try {
                            const replyRes = await fetch(`/api/community-replies?postId=${encodeURIComponent(post.id)}`);
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
    }, []);

    const handleLikePost = (postId: string) => {
        setPosts((prevPosts) => prevPosts.map((post) => (post.id === postId ? { ...post, likes: post.likes + 1 } : post)));
    };

    const handleReplySubmit = async (e: React.FormEvent, postId: string) => {
        e.preventDefault();
        if (!newReplyContent.trim()) return;

        const storedUser = readStoredUser();
        const message = newReplyContent.trim();

        try {
            const res = await fetch("/api/community-replies", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    postId,
                    message,
                    author: storedUser?.id,
                    authorName: storedUser?.name ?? "Current User",
                }),
            });
            if (!res.ok) return;

            const createdReply = (await res.json()) as ApiReply;
            const mappedReply = mapApiReply(createdReply);

            setPosts((prevPosts) =>
                prevPosts.map((post) => (post.id === postId ? { ...post, replies: [mappedReply, ...post.replies] } : post))
            );
            setNewReplyContent("");
        } catch {
            // Retain current input on network errors.
        }
    };

    const toggleReplySection = (postId: string) => {
        if (expandedPostId === postId) {
            setExpandedPostId(null);
            return;
        }
        setExpandedPostId(postId);
        setNewReplyContent("");
        void loadRepliesForPost(postId);
    };

    const handleLogout = () => {
        clearDemoSession();
        setIsProfileMenuOpen(false);
        router.push("/");
    };

    return (
        <main
            className="relative h-screen overflow-hidden text-[#0f0f0f]"
            style={{ backgroundImage: `url(${communityBackground.src})`, backgroundSize: "cover", backgroundPosition: "center" }}
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
                            <span className="text-lg font-bold tracking-tight text-slate-800">Community</span>
                        </div>
                    </div>

                    <div className="hidden w-full max-w-2xl items-center gap-2 md:flex">
                        <div className="flex h-10 flex-1 items-center rounded-full border border-blue-200 bg-white/90 px-4">
                            <Search size={18} className="text-slate-500" />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search community posts"
                                className="ml-3 w-full bg-transparent text-sm text-slate-700 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <Link
                            href="/community/post/create"
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
                                            onClick={handleLogout}
                                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-blue-50"
                                        >
                                            <LogOut size={16} /> Logout
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
                    className={`fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-72 border-r border-blue-100 bg-slate-100/95 p-3 transition-transform lg:static lg:translate-x-0 ${
                        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:hidden"
                    }`}
                >
                    <div className="space-y-1">
                        <Link href="/community" className="flex items-center gap-3 rounded-xl bg-blue-100 px-3 py-2.5 text-sm font-semibold text-blue-900">
                            <Home size={18} /> Home
                        </Link>
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(false)}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-blue-100 lg:hidden"
                        >
                            <X size={18} /> Hide Menu
                        </button>
                    </div>

                    <div className="my-3 h-px bg-blue-100" />

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
                            <div className="mt-3 space-y-2">
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

                    <div className="mt-3 rounded-xl border border-blue-100 bg-white/95 p-3">
                        <button
                            type="button"
                            onClick={() => setIsRecentVisible((prev) => !prev)}
                            className="flex w-full items-center justify-between text-sm font-semibold text-slate-700"
                        >
                            <span className="flex items-center gap-2">
                                <Clock size={16} /> Recent Status
                            </span>
                            {isRecentVisible ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {isRecentVisible && (
                            <div className="mt-3 space-y-2">
                                {RECENT_ACTIVITY.map((activity) => (
                                    <div key={activity.id} className="rounded-lg px-2 py-1.5 hover:bg-blue-50">
                                        <p className="text-sm leading-snug text-slate-700">{activity.content}</p>
                                        <p className="mt-1 text-xs text-slate-500">{activity.time}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>

                <section className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
                    <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
                        {CATEGORIES.map((category) => (
                            <button
                                key={category}
                                onClick={() => setActiveCategory(category)}
                                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${
                                    activeCategory === category
                                        ? "bg-blue-700 text-white"
                                        : "bg-slate-200 text-slate-700 hover:bg-blue-100"
                                }`}
                            >
                                {categoryLabel[category]}
                            </button>
                        ))}
                    </div>

                    {filteredPosts.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-blue-200 bg-white/95 p-10 text-center text-slate-500">
                            No matching posts found.
                        </div>
                    ) : (
                        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
                            {filteredPosts.map((post) => (
                                <Card key={post.id} className="overflow-hidden rounded-2xl border border-blue-100 bg-white/95 shadow-none">
                                    <div className={`relative h-44 bg-gradient-to-r ${thumbnailStyle[post.category]}`}>
                                        <div className="absolute inset-0 bg-blue-900/20" />
                                        <div className="absolute bottom-3 left-3 rounded-md bg-slate-900/80 px-2 py-1 text-xs font-semibold text-white">
                                            {categoryLabel[post.category]}
                                        </div>
                                    </div>

                                    <div className="p-4">
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

                                        <div className="mt-4 flex items-center gap-2 border-t border-blue-100 pt-3">
                                            <button
                                                onClick={() => handleLikePost(post.id)}
                                                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-slate-700 hover:bg-blue-50"
                                            >
                                                <ThumbsUp size={16} /> {post.likes}
                                            </button>
                                            <button
                                                onClick={() => toggleReplySection(post.id)}
                                                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-slate-700 hover:bg-blue-50"
                                            >
                                                <MessageSquare size={16} /> Reply
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
                                                            <p className="mt-1 text-sm text-slate-700">{reply.content}</p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            <form onSubmit={(e) => handleReplySubmit(e, post.id)} className="mt-4">
                                                <Textarea
                                                    value={newReplyContent}
                                                    onChange={(e) => setNewReplyContent(e.target.value)}
                                                    placeholder="Write a reply..."
                                                    className="min-h-[90px] border-blue-200 bg-white text-sm"
                                                />
                                                <div className="mt-3 flex justify-end">
                                                    <Button
                                                        type="submit"
                                                        variant="dark"
                                                        className="gap-2 bg-blue-700 hover:bg-blue-800"
                                                        disabled={!newReplyContent.trim()}
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
            </div>
            </div>
        </main>
    );
}

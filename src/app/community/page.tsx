"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    MessageSquare,
    Share2,
    Filter,
    Plus,
    Send,
    ArrowLeft,
    User,
    Clock,
    ThumbsUp
} from "lucide-react";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import communityBackground from "@/app/images/community/community2.jpg";
import { readStoredUser } from "@/lib/rbac";

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
    author:
        typeof reply.author === "object" && reply.author?.name
            ? reply.author.name
            : "Current User",
    content: reply.message,
    createdAt: toTimeAgo(reply.createdAt),
});

const CATEGORIES = ["all", "lost_item", "study_material", "academic_question"] as const;

const INITIAL_POSTS: Post[] = [
    {
        id: "1",
        title: "Best resources for learning Next.js 14?",
        content: "Hey everyone! I'm starting to learn Next.js 14 App Router. Does anyone have good recommendations for courses or reading material?",
        author: "Alex Johnson",
        category: "academic_question",
        createdAt: "2 hours ago",
        likes: 12,
        replies: [
            {
                id: "r1",
                author: "Sarah Smith",
                content: "I recommend the official Next.js documentation, it is really comprehensive and includes a great tutorial!",
                createdAt: "1 hour ago"
            }
        ]
    },
    {
        id: "2",
        title: "Campus Hackathon this Weekend!",
        content: "Don't forget that the annual campus hackathon is happening this weekend at the main library. Registration is still open until Friday. Free pizza!",
        author: "Tech Club",
        category: "study_material",
        createdAt: "5 hours ago",
        likes: 45,
        replies: []
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
                createdAt: "12 hours ago"
            }
        ]
    }
];

export default function CommunityPage() {
    const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
    const [activeCategory, setActiveCategory] = useState<(typeof CATEGORIES)[number]>("all");

    // State to track which post has its reply section expanded
    const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
    const [newReplyContent, setNewReplyContent] = useState("");

    const filteredPosts = posts.filter(post =>
        activeCategory === "all" || post.category === activeCategory
    );

    const loadRepliesForPost = async (postId: string) => {
        try {
            const res = await fetch(`/api/community-replies?postId=${encodeURIComponent(postId)}`);
            if (!res.ok) return;

            const data = (await res.json()) as ApiReply[];
            const mappedReplies = data.map(mapApiReply);

            setPosts((prevPosts) =>
                prevPosts.map((post) =>
                    post.id === postId ? { ...post, replies: mappedReplies } : post
                )
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
                    author:
                        typeof post.author === "object" && post.author?.name
                            ? post.author.name
                            : "Current User",
                    category: mapCategory(post.category),
                    createdAt: toTimeAgo(post.createdAt),
                    likes: 0,
                    replies: [],
                }));

                setPosts(mapped);

                const repliesPerPost = await Promise.all(
                    mapped.map(async (post) => {
                        try {
                            const replyRes = await fetch(
                                `/api/community-replies?postId=${encodeURIComponent(post.id)}`
                            );
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
        setPosts(posts.map(post => {
            if (post.id === postId) {
                return { ...post, likes: post.likes + 1 };
            }
            return post;
        }));
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

            if (!res.ok) {
                return;
            }

            const createdReply = (await res.json()) as ApiReply;
            const mappedReply = mapApiReply(createdReply);

            setPosts((prevPosts) =>
                prevPosts.map((post) =>
                    post.id === postId ? { ...post, replies: [mappedReply, ...post.replies] } : post
                )
            );

            setNewReplyContent("");
        } catch {
            // No-op for now; retain current input on network errors.
        }
    };

    const toggleReplySection = (postId: string) => {
        if (expandedPostId === postId) {
            setExpandedPostId(null);
        } else {
            setExpandedPostId(postId);
            setNewReplyContent(""); // Reset reply input when opening a new one
            void loadRepliesForPost(postId);
        }
    };

    return (
        <main
            className="min-h-screen bg-cover bg-center bg-no-repeat py-10 lg:py-16"
            style={{ backgroundImage: `url(${communityBackground.src})` }}
        >
            <Container size="6xl">
                <div className="rounded-3xl border border-gray-500/40 bg-gray-200/90 p-6 shadow-shadow md:p-8">
                <div className="mb-8">
                    <Link
                        className="inline-flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-2 text-sm font-semibold text-text shadow-sm transition-all hover:bg-gray-50 hover:shadow-md"
                        href="/community-help"
                    >
                        <ArrowLeft size={16} />
                        Back to Support Space
                    </Link>
                </div>

                <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight text-heading sm:text-4xl">
                            Community Space
                        </h1>
                        <p className="mt-2 text-text/80">
                            Connect with your peers, share resources, and ask questions.
                        </p>
                    </div>
                    <Link
                        href="/community-help/post/create"
                        className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                        <Plus size={18} />
                        Create Post
                    </Link>
                </div>

                {/* Filters */}
                <div className="mb-8 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-text/60 mr-2">
                        <Filter size={18} />
                        <span className="text-sm font-medium">Filter by:</span>
                    </div>
                    {CATEGORIES.map(category => (
                        <button
                            key={category}
                            onClick={() => setActiveCategory(category)}
                            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${activeCategory === category
                                ? "bg-primary text-white shadow-md"
                                : "bg-gray-100 text-text/80 border border-gray-400/50 hover:bg-gray-50"
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                {/* Posts List */}
                <div className="space-y-6">
                    {filteredPosts.length === 0 ? (
                        <div className="rounded-3xl border border-gray-500/40 border-dashed bg-gray-100/80 py-16 text-center">
                            <p className="text-text/60">No posts found in this category.</p>
                            <Button
                                variant="ghost"
                                className="mt-4"
                                onClick={() => setActiveCategory("all")}
                            >
                                View all posts
                            </Button>
                        </div>
                    ) : (
                        filteredPosts.map(post => (
                            <Card key={post.id} className="overflow-hidden transition-all hover:shadow-md">
                                <div className="p-6">
                                    {/* Post Header */}
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                <User size={20} />
                                            </div>
                                            <div>
                                                <div className="font-medium text-heading">{post.author}</div>
                                                <div className="flex items-center gap-2 text-xs text-text/60">
                                                    <span className="flex items-center gap-1"><Clock size={12} /> {post.createdAt}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="rounded-full bg-tint px-3 py-1 text-xs font-medium text-text/80 border border-border">
                                            {post.category}
                                        </span>
                                    </div>

                                    {/* Post Content */}
                                    <h3 className="mb-2 text-xl font-semibold text-heading">{post.title}</h3>
                                    <p className="text-text/80 leading-relaxed">{post.content}</p>

                                    {/* Post Actions */}
                                    <div className="mt-6 flex items-center gap-4 border-t border-border pt-4">
                                        <button
                                            onClick={() => handleLikePost(post.id)}
                                            className="flex items-center gap-1.5 text-sm font-medium text-text/60 transition-colors hover:text-primary"
                                        >
                                            <ThumbsUp size={18} />
                                            {post.likes > 0 && <span>{post.likes}</span>}
                                        </button>
                                        <button
                                            onClick={() => toggleReplySection(post.id)}
                                            className="flex items-center gap-1.5 text-sm font-medium text-text/60 transition-colors hover:text-primary"
                                        >
                                            <MessageSquare size={18} />
                                            <span>{post.replies.length} Replies</span>
                                        </button>
                                        <button className="flex items-center gap-1.5 text-sm font-medium text-text/60 transition-colors hover:text-primary ml-auto">
                                            <Share2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Replies Section Area */}
                                {expandedPostId === post.id && (
                                    <div className="bg-gray-100/80 border-t border-gray-400/50 p-6 animate-in fade-in slide-in-from-top-2">
                                        {/* Reply List */}
                                        <div className="mb-6 space-y-4">
                                            {post.replies.length === 0 ? (
                                                <p className="text-center text-sm text-text/60 py-4">No replies yet. Be the first to reply!</p>
                                            ) : (
                                                post.replies.map(reply => (
                                                    <div key={reply.id} className="flex gap-3">
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 border border-gray-400/50 text-text/60">
                                                            <User size={14} />
                                                        </div>
                                                        <div className="flex-1 rounded-2xl rounded-tl-none bg-gray-50 p-4 shadow-sm border border-gray-400/50">
                                                            <div className="mb-1 flex items-center justify-between">
                                                                <span className="text-sm font-semibold text-heading">{reply.author}</span>
                                                                <span className="text-xs text-text/50">{reply.createdAt}</span>
                                                            </div>
                                                            <p className="text-sm text-text/80">{reply.content}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Reply Input Form */}
                                        <form onSubmit={(e) => handleReplySubmit(e, post.id)} className="flex items-start gap-3 mt-4">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                <User size={14} />
                                            </div>
                                            <div className="flex-1 space-y-3">
                                                <Textarea
                                                    placeholder="Write a reply..."
                                                    className="min-h-[80px] bg-gray-50 text-sm resize-y"
                                                    value={newReplyContent}
                                                    onChange={(e) => setNewReplyContent(e.target.value)}
                                                    autoFocus
                                                />
                                                <div className="flex justify-end">
                                                    <Button
                                                        type="submit"
                                                        variant="dark"
                                                        className="py-1.5 gap-2"
                                                        disabled={!newReplyContent.trim()}
                                                    >
                                                        <Send size={14} /> Reply
                                                    </Button>
                                                </div>
                                            </div>
                                        </form>
                                    </div>
                                )}
                            </Card>
                        ))
                    )}
                </div>
                </div>
            </Container>

        </main>
    );
}

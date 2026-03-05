"use client";

import { useState } from "react";
import Link from "next/link";
import {
    MessageSquare,
    Heart,
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
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
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
    category: string;
    createdAt: string;
    likes: number;
    replies: Reply[];
};

const CATEGORIES = ["All", "Questions", "Discussions", "Events", "Resources"];

const INITIAL_POSTS: Post[] = [
    {
        id: "1",
        title: "Best resources for learning Next.js 14?",
        content: "Hey everyone! I'm starting to learn Next.js 14 App Router. Does anyone have good recommendations for courses or reading material?",
        author: "Alex Johnson",
        category: "Questions",
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
        category: "Events",
        createdAt: "5 hours ago",
        likes: 45,
        replies: []
    },
    {
        id: "3",
        title: "Study group for Data Structures",
        content: "Looking for 2-3 people to join our study group for the upcoming Data Structures midterm. We meet Tuesdays and Thursdays.",
        author: "Michael Lee",
        category: "Discussions",
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
    const [activeCategory, setActiveCategory] = useState("All");
    const [isCreatingPost, setIsCreatingPost] = useState(false);
    const [newPostTitle, setNewPostTitle] = useState("");
    const [newPostContent, setNewPostContent] = useState("");
    const [newPostCategory, setNewPostCategory] = useState("Discussions");

    // State to track which post has its reply section expanded
    const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
    const [newReplyContent, setNewReplyContent] = useState("");

    const filteredPosts = posts.filter(post =>
        activeCategory === "All" || post.category === activeCategory
    );

    const handleCreatePost = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPostTitle.trim() || !newPostContent.trim()) return;

        const newPost: Post = {
            id: Date.now().toString(),
            title: newPostTitle,
            content: newPostContent,
            author: "Current User", // Mock user
            category: newPostCategory,
            createdAt: "Just now",
            likes: 0,
            replies: []
        };

        setPosts([newPost, ...posts]);
        setNewPostTitle("");
        setNewPostContent("");
        setIsCreatingPost(false);
    };

    const handleLikePost = (postId: string) => {
        setPosts(posts.map(post => {
            if (post.id === postId) {
                return { ...post, likes: post.likes + 1 };
            }
            return post;
        }));
    };

    const handleReplySubmit = (e: React.FormEvent, postId: string) => {
        e.preventDefault();
        if (!newReplyContent.trim()) return;

        const newReply: Reply = {
            id: Date.now().toString(),
            author: "Current User", // Mock user
            content: newReplyContent,
            createdAt: "Just now"
        };

        setPosts(posts.map(post => {
            if (post.id === postId) {
                return { ...post, replies: [...post.replies, newReply] };
            }
            return post;
        }));

        setNewReplyContent("");
    };

    const toggleReplySection = (postId: string) => {
        if (expandedPostId === postId) {
            setExpandedPostId(null);
        } else {
            setExpandedPostId(postId);
            setNewReplyContent(""); // Reset reply input when opening a new one
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
                    <Button
                        onClick={() => setIsCreatingPost(!isCreatingPost)}
                        className="flex items-center gap-2 rounded-full px-6 py-3"
                    >
                        {isCreatingPost ? "Cancel" : <><Plus size={18} /> Create Post</>}
                    </Button>
                </div>

                {/* Create Post Form */}
                {isCreatingPost && (
                    <Card className="mb-10 overflow-hidden border-2 border-primary/20 p-6 shadow-sm transition-all animate-in fade-in slide-in-from-top-4">
                        <h2 className="mb-4 text-xl font-semibold text-heading">Create a New Post</h2>
                        <form onSubmit={handleCreatePost} className="space-y-4">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-text/80">Title</label>
                                <Input
                                    placeholder="What's on your mind?"
                                    value={newPostTitle}
                                    onChange={(e) => setNewPostTitle(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-text/80">Category</label>
                                <select
                                    className="w-full rounded-[16px] border border-border bg-card px-3.5 py-2.5 text-sm text-text transition-colors placeholder:text-text/55 focus:border-primary focus:outline-none focus:ring-2 focus:ring-focus"
                                    value={newPostCategory}
                                    onChange={(e) => setNewPostCategory(e.target.value)}
                                >
                                    {CATEGORIES.filter(c => c !== "All").map(category => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-text/80">Details</label>
                                <Textarea
                                    placeholder="Share the details here..."
                                    rows={4}
                                    value={newPostContent}
                                    onChange={(e) => setNewPostContent(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end pt-2">
                                <Button type="submit" variant="primary">Post to Community</Button>
                            </div>
                        </form>
                    </Card>
                )}

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
                                onClick={() => setActiveCategory("All")}
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
                                                        variant="primary"
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

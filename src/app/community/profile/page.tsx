"use client";

import Link from "next/link";
import { ArrowLeft, User, CheckCircle, Clock, FileText, MessageSquare, Star, ThumbsUp } from "lucide-react";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import communityBackground from "@/app/images/community/community2.jpg";

const PROFILE_DATA = {
    name: "Current User",
    role: "Verified Mentor",
    reputation: 1250,
    joined: "Aug 2024",
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
    ]
};

export default function CommunityProfilePage() {
    return (
        <main
            className="min-h-screen bg-cover bg-center bg-no-repeat py-10 lg:py-16"
            style={{ backgroundImage: `url(${communityBackground.src})` }}
        >
            <Container size="6xl">
                <div className="rounded-3xl border border-gray-500/40 bg-gray-200/90 p-6 shadow-shadow md:p-8">
                    <div className="mb-8">
                        <Link
                            className="inline-flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-2 text-sm font-semibold text-text shadow-sm transition-all hover:bg-gray-50 hover:shadow-md border border-gray-300/50"
                            href="/community"
                        >
                            <ArrowLeft size={16} />
                            Back to Community Space
                        </Link>
                    </div>

                    {/* Profile Header Block */}
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-10 pb-8 border-b border-gray-400/40">
                        <div className="flex-shrink-0 h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-inner border border-primary/20">
                            <User size={48} />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-3xl font-bold text-heading flex items-center justify-center md:justify-start gap-3">
                                {PROFILE_DATA.name}
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white tracking-wide shadow-sm">
                                    <CheckCircle size={14} />
                                    {PROFILE_DATA.role}
                                </span>
                            </h1>
                            <p className="mt-2 text-text/70 font-medium flex items-center justify-center md:justify-start gap-2">
                                <Clock size={16} /> Joined {PROFILE_DATA.joined}
                            </p>

                            <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-4">
                                <div className="flex items-center gap-3 bg-white/70 px-4 py-2.5 rounded-2xl shadow-sm border border-gray-300/50">
                                    <div className="p-1.5 bg-yellow-100 text-yellow-600 rounded-full">
                                        <Star size={18} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-text/60 font-semibold uppercase tracking-wider">Reputation</p>
                                        <p className="text-lg font-bold text-heading leading-none">{PROFILE_DATA.reputation}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 bg-white/70 px-4 py-2.5 rounded-2xl shadow-sm border border-gray-300/50">
                                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded-full">
                                        <FileText size={18} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-text/60 font-semibold uppercase tracking-wider">Total Posts</p>
                                        <p className="text-lg font-bold text-heading leading-none">{PROFILE_DATA.stats.posts}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 bg-white/70 px-4 py-2.5 rounded-2xl shadow-sm border border-gray-300/50">
                                    <div className="p-1.5 bg-green-100 text-green-600 rounded-full">
                                        <ThumbsUp size={18} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-text/60 font-semibold uppercase tracking-wider">Helpful</p>
                                        <p className="text-lg font-bold text-heading leading-none">{PROFILE_DATA.stats.helpful}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex-shrink-0 mt-4 md:mt-0">
                            <button className="rounded-full bg-gray-100 hover:bg-gray-50 border border-gray-300 px-6 py-2.5 text-sm font-semibold text-text shadow-sm transition-all focus:ring-2 focus:ring-primary/20">
                                Edit Profile
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left Column: Recent Posts */}
                        <div>
                            <h2 className="text-lg font-bold text-heading mb-4 flex items-center gap-2">
                                <FileText className="text-primary" size={20} /> My Recent Posts
                            </h2>
                            <div className="space-y-4">
                                {PROFILE_DATA.recentPosts.map(post => (
                                    <Card key={post.id} className="p-5 hover:shadow-md transition-shadow bg-gray-50 border border-gray-300/60">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="rounded-full bg-gray-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text/70">
                                                {post.category}
                                            </span>
                                            <span className="text-xs text-text/50 font-medium">{post.time}</span>
                                        </div>
                                        <h3 className="font-semibold text-heading text-base leading-snug mb-3 hover:text-primary cursor-pointer transition-colors">
                                            {post.title}
                                        </h3>
                                        <div className="flex items-center gap-4 text-xs font-medium text-text/60 mt-auto">
                                            <span className="flex items-center gap-1.5"><ThumbsUp size={14} /> {post.likes}</span>
                                            <span className="flex items-center gap-1.5"><MessageSquare size={14} /> {post.replies}</span>
                                        </div>
                                    </Card>
                                ))}
                                <button className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-400/50 text-sm font-medium text-text/70 hover:bg-gray-200/50 hover:text-primary transition-colors">
                                    View all posts
                                </button>
                            </div>
                        </div>

                        {/* Right Column: Recent Replies */}
                        <div>
                            <h2 className="text-lg font-bold text-heading mb-4 flex items-center gap-2">
                                <MessageSquare className="text-primary" size={20} /> My Recent Replies
                            </h2>
                            <div className="space-y-4">
                                {PROFILE_DATA.recentReplies.map(reply => (
                                    <Card key={reply.id} className="p-5 hover:shadow-md transition-shadow bg-gray-50 border border-gray-300/60">
                                        <p className="text-xs text-text/60 font-medium mb-1 line-clamp-1">
                                            Replying to: <span className="font-semibold text-heading">{reply.postTitle}</span>
                                        </p>
                                        <p className="text-sm text-text/80 leading-relaxed mb-3">
                                            "{reply.content}"
                                        </p>
                                        <div className="text-xs text-text/50 font-medium">
                                            {reply.time}
                                        </div>
                                    </Card>
                                ))}
                                <button className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-400/50 text-sm font-medium text-text/70 hover:bg-gray-200/50 hover:text-primary transition-colors">
                                    View all replies
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </Container>
        </main>
    );
}

"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Award,
    BookMarked,
    CalendarDays,
    CheckCircle2,
    Eye,
    FileText,
    Flame,
    MessageSquare,
    Star,
    ThumbsUp,
    User,
    Users,
} from "lucide-react";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import communityBackground from "@/app/images/community/community2.jpg";
import { readCommunityProfileSettings } from "@/lib/community-profile";
import { readStoredUser } from "@/lib/rbac";

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
    ]
};

function roleToCommunityLabel(role: string | undefined) {
    if (role === "SUPER_ADMIN") return "Community Admin";
    if (role === "LECTURER") return "Verified Mentor";
    if (role === "LOST_ITEM_STAFF") return "Support Staff";
    return "Student Member";
}

export default function CommunityProfilePage() {
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
        };
    }, []);

    return (
        <main
            className="relative min-h-screen py-10 lg:py-14"
            style={{
                backgroundImage: `url(${communityBackground.src})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
            }}
        >
            <div className="absolute inset-0 bg-slate-100/78" />
            <Container size="6xl">
                <div className="relative z-10 rounded-3xl border border-blue-200 bg-slate-50/90 p-5 shadow-shadow md:p-8">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                        <Link
                            className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-blue-50"
                            href="/community"
                        >
                            <ArrowLeft size={16} />
                            Back to Community
                        </Link>
                        <Link
                            href="/community/Settings"
                            className="rounded-full bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
                        >
                            Edit Profile
                        </Link>
                    </div>

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

                    <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-3">
                        <Card className="rounded-2xl border border-blue-100 bg-white p-5 shadow-none">
                            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                                <Award size={18} className="text-blue-700" />
                                Contribution Highlights
                            </h2>
                            <ul className="mt-4 space-y-3 text-sm text-slate-700">
                                <li className="rounded-xl bg-blue-50 p-3">Top 5% helper in academic questions this month.</li>
                                <li className="rounded-xl bg-blue-50 p-3">Recognized by 12 members as a study mentor.</li>
                                <li className="rounded-xl bg-blue-50 p-3">Maintained active participation for over 3 weeks.</li>
                            </ul>
                        </Card>
                        <Card className="rounded-2xl border border-blue-100 bg-white p-5 shadow-none">
                            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                                <Users size={18} className="text-blue-700" />
                                Community Reach
                            </h2>
                            <div className="mt-4 space-y-3 text-sm">
                                <div className="rounded-xl bg-slate-50 p-3">
                                    <p className="text-slate-500">Followers</p>
                                    <p className="mt-1 text-xl font-bold text-slate-800">214</p>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-3">
                                    <p className="text-slate-500">Mentions in Posts</p>
                                    <p className="mt-1 text-xl font-bold text-slate-800">37</p>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-3">
                                    <p className="text-slate-500">Shared Resources</p>
                                    <p className="mt-1 text-xl font-bold text-slate-800">19</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="rounded-2xl border border-blue-100 bg-white p-5 shadow-none">
                            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                                <BookMarked size={18} className="text-blue-700" />
                                Focus Areas
                            </h2>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {["Exam Prep", "Web Development", "Study Group", "Campus Support", "Project Reviews"].map((tag) => (
                                    <span
                                        key={tag}
                                        className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                            <div className="mt-5 rounded-xl bg-blue-700 p-4 text-white">
                                <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">Availability</p>
                                <p className="mt-1 text-sm">Usually active between 6:00 PM and 10:00 PM.</p>
                            </div>
                        </Card>
                    </div>

                    <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <div>
                            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
                                <FileText size={20} className="text-blue-700" /> Recent Posts
                            </h2>
                            <div className="space-y-4">
                                {profileData.recentPosts.map((post) => (
                                    <Card key={post.id} className="rounded-2xl border border-blue-100 bg-white p-4 shadow-none">
                                        <div className="mb-3 flex items-start justify-between gap-2">
                                            <span className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-800">
                                                {post.category.replace("_", " ")}
                                            </span>
                                            <span className="text-xs text-slate-500">{post.time}</span>
                                        </div>
                                        <h3 className="text-base font-semibold leading-snug text-slate-800">{post.title}</h3>
                                        <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-slate-600">
                                            <span className="inline-flex items-center gap-1.5">
                                                <ThumbsUp size={14} /> {post.likes}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5">
                                                <MessageSquare size={14} /> {post.replies}
                                            </span>
                                        </div>
                                    </Card>
                                ))}
                                <button className="w-full rounded-2xl border border-dashed border-blue-300 bg-blue-50 py-3 text-sm font-semibold text-blue-800 transition hover:bg-blue-100">
                                    <span className="inline-flex items-center gap-2">
                                        <Eye size={15} />
                                        View all posts
                                    </span>
                                </button>
                            </div>
                        </div>

                        <div>
                            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
                                <MessageSquare size={20} className="text-blue-700" /> Recent Replies
                            </h2>
                            <div className="space-y-4">
                                {profileData.recentReplies.map((reply) => (
                                    <Card key={reply.id} className="rounded-2xl border border-blue-100 bg-white p-4 shadow-none">
                                        <p className="text-xs font-semibold text-slate-500">
                                            Replying to <span className="text-slate-700">{reply.postTitle}</span>
                                        </p>
                                        <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                                            {reply.content}
                                        </p>
                                        <p className="mt-2 text-xs text-slate-500">{reply.time}</p>
                                    </Card>
                                ))}
                                <button className="w-full rounded-2xl border border-dashed border-blue-300 bg-blue-50 py-3 text-sm font-semibold text-blue-800 transition hover:bg-blue-100">
                                    <span className="inline-flex items-center gap-2">
                                        <Eye size={15} />
                                        View all replies
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-100/60 p-4 text-sm text-blue-900">
                        Keep helping others, and your mentor badge progression will update automatically based on community contributions.
                    </div>
                </div>
            </Container>
        </main>
    );
}

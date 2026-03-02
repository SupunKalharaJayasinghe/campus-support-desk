"use client";

import { useState } from "react";

const mockPosts = [
    {
        id: 1,
        title: "Lost my TI-84 calculator near Library Block B",
        category: "Lost Items",
        tags: ["calculator", "library", "urgent"],
        status: "Open",
        author: "Ahmad Razif",
        avatar: "AR",
        reputation: 245,
        level: "Scholar",
        replies: 3,
        upvotes: 7,
        time: "2h ago",
        hasAccepted: false,
        content: "I lost my silver TI-84 Plus calculator somewhere near Library Block B around 2pm today. It has a small scratch on the back cover. Please contact me if found!",
    },
    {
        id: 2,
        title: "Can anyone share Data Structures past year papers 2022-2023?",
        category: "Study Materials",
        tags: ["data-structures", "past-year", "CS"],
        status: "Resolved",
        author: "Priya Nair",
        avatar: "PN",
        reputation: 512,
        level: "Expert",
        replies: 8,
        upvotes: 24,
        time: "1d ago",
        hasAccepted: true,
        content: "Looking for Data Structures and Algorithms past year exam papers for 2022 and 2023 semesters. Particularly need the ones with graph algorithms.",
    },
    {
        id: 3,
        title: "How do I implement Dijkstra's algorithm efficiently?",
        category: "Academic Questions",
        tags: ["algorithms", "python", "graph"],
        status: "Open",
        author: "Lee Wei Jian",
        avatar: "LW",
        reputation: 89,
        level: "Newcomer",
        replies: 5,
        upvotes: 12,
        time: "3h ago",
        hasAccepted: false,
        content: "I'm trying to implement Dijkstra's shortest path algorithm for my assignment but struggling with the priority queue implementation. Can someone explain with code?",
    },
    {
        id: 4,
        title: "Free calculus textbook PDF - Calculus by James Stewart",
        category: "Study Materials",
        tags: ["calculus", "mathematics", "textbook"],
        status: "Archived",
        author: "Siti Hajar",
        avatar: "SH",
        reputation: 780,
        level: "Expert",
        replies: 15,
        upvotes: 67,
        time: "1w ago",
        hasAccepted: true,
        content: "Sharing the PDF for Calculus by James Stewart 8th edition. This helped me pass my Calculus 2 course. Hope it helps others!",
    },
    {
        id: 5,
        title: "What is the difference between TCP and UDP protocols?",
        category: "Academic Questions",
        tags: ["networking", "TCP", "UDP"],
        status: "Draft",
        author: "Raj Kumar",
        avatar: "RK",
        reputation: 34,
        level: "Newcomer",
        replies: 0,
        upvotes: 0,
        time: "just now",
        hasAccepted: false,
        content: "I'm preparing for my networking exam. Can someone clearly explain the core differences between TCP and UDP with examples of when to use each?",
    },
];

const mockReplies = [
    {
        id: 1,
        postId: 3,
        author: "Priya Nair",
        avatar: "PN",
        reputation: 512,
        level: "Expert",
        content: "Use a min-heap (priority queue) with (distance, node) tuples. In Python, you can use `heapq`. Initialize all distances to infinity except the source. At each step, pop the smallest distance node and relax its neighbors.",
        upvotes: 18,
        isAccepted: true,
        time: "2h ago",
    },
    {
        id: 2,
        postId: 3,
        author: "Ahmad Razif",
        avatar: "AR",
        reputation: 245,
        level: "Scholar",
        content: "Here's a clean Python implementation: use `heapq.heappush` and `heappop`. Key insight: once a node is popped from the heap, you've found its shortest path — no need to revisit.",
        upvotes: 9,
        isAccepted: false,
        time: "1h ago",
    },
];

const trendingTags = ["algorithms", "calculus", "networking", "python", "data-structures", "urgent", "CS", "mathematics"];

const topUsers = [
    { name: "Siti Hajar", avatar: "SH", rep: 780, level: "Expert", resolved: 12 },
    { name: "Priya Nair", avatar: "PN", rep: 512, level: "Expert", resolved: 8 },
    { name: "Ahmad Razif", avatar: "AR", rep: 245, level: "Scholar", resolved: 5 },
    { name: "Lee Wei Jian", avatar: "LW", rep: 89, level: "Newcomer", resolved: 2 },
];

const categoryColors: Record<string, { bg: string, text: string, border: string, dot: string }> = {
    "Lost Items": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
    "Study Materials": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
    "Academic Questions": { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", dot: "bg-sky-500" },
};

const statusConfig: Record<string, { bg: string, text: string }> = {
    Draft: { bg: "bg-gray-100", text: "text-gray-600" },
    Open: { bg: "bg-blue-50", text: "text-blue-600" },
    Resolved: { bg: "bg-emerald-50", text: "text-emerald-600" },
    Archived: { bg: "bg-gray-200", text: "text-gray-600" },
};

const levelConfig: Record<string, { color: string, icon: string }> = {
    Newcomer: { color: "text-gray-500", icon: "◇" },
    Scholar: { color: "text-sky-600", icon: "◈" },
    Expert: { color: "text-[#034AA6]", icon: "◆" },
};

function Avatar({ initials, size = "sm" }: { initials: string, size?: string }) {
    const sizes: Record<string, string> = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base" };
    const colors: Record<string, string> = {
        AR: "from-orange-400 to-rose-500", PN: "from-[#034AA6] to-[#0339A6]",
        LW: "from-sky-400 to-blue-500", SH: "from-emerald-400 to-teal-500",
        RK: "from-amber-400 to-orange-500",
    };
    return (
        <div className={`${sizes[size]} rounded-full bg-gradient-to-br ${colors[initials] || "from-gray-400 to-gray-500"} flex items-center justify-center font-bold text-white shrink-0`}>
            {initials}
        </div>
    );
}

function Badge({ children, className = "" }: { children: React.ReactNode, className?: string }) {
    return <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${className}`}>{children}</span>;
}

function PostCard({ post, onClick, isActive }: { post: any, onClick: (p: any) => void, isActive: boolean }) {
    const cat = categoryColors[post.category] || {};
    const stat = statusConfig[post.status] || {};
    return (
        <div
            onClick={() => onClick(post)}
            className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:translate-y-[-1px] ${isActive
                ? "border-[#034AA6]/40 bg-[#034AA6]/5 shadow-sm shadow-[#034AA6]/10"
                : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                }`}
        >
            <div className="flex items-start gap-3">
                <Avatar initials={post.avatar} />
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2 mb-1.5">
                        <Badge className={`${cat.bg} ${cat.text} ${cat.border}`}>{post.category}</Badge>
                        <Badge className={`${stat.bg} ${stat.text} border-transparent`}>{post.status}</Badge>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 mb-2">{post.title}</h3>
                    <div className="flex flex-wrap gap-1 mb-2">
                        {post.tags.slice(0, 3).map((tag: string) => (
                            <span key={tag} className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">#{tag}</span>
                        ))}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                            <span>▲</span><span>{post.upvotes}</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <span>💬</span><span>{post.replies}</span>
                        </span>
                        {post.hasAccepted && <span className="text-emerald-600 flex items-center gap-0.5"><span>✓</span> Answered</span>}
                        <span className="ml-auto">{post.time}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SimilarPostAlert({ query }: { query: string }) {
    if (query.length < 10) return null;
    return (
        <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
            <div className="font-semibold mb-1">⚠ Similar posts detected</div>
            <div className="text-amber-600">We found 2 existing posts that may answer your question. Check them before posting to avoid duplicates.</div>
            <div className="mt-1.5 space-y-1">
                <div className="bg-amber-100 rounded p-1.5 hover:bg-amber-200 cursor-pointer">"How do I implement Dijkstra's algorithm efficiently?"</div>
                <div className="bg-amber-100 rounded p-1.5 hover:bg-amber-200 cursor-pointer">"Best way to solve shortest path problems in Python?"</div>
            </div>
        </div>
    );
}

function PostDetail({ post, onClose }: { post: any, onClose: () => void }) {
    const [replyText, setReplyText] = useState("");
    const [localReplies, setLocalReplies] = useState(mockReplies.filter(r => r.postId === post.id));
    const [upvoted, setUpvoted] = useState<Record<string, boolean>>({});

    const handleReply = () => {
        if (!replyText.trim()) return;
        const newReply = {
            id: Date.now(), postId: post.id, author: "You", avatar: "YO",
            reputation: 10, level: "Newcomer", content: replyText,
            upvotes: 0, isAccepted: false, time: "just now",
        };
        setLocalReplies(prev => [...prev, newReply]);
        setReplyText("");
    };

    const canReply = post.status !== "Archived";
    const cat = categoryColors[post.category] || {};
    const stat = statusConfig[post.status] || {};

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                    <Badge className={`${cat.bg} ${cat.text} ${cat.border}`}>{post.category}</Badge>
                    <Badge className={`${stat.bg} ${stat.text} border-transparent`}>{post.status}</Badge>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <h2 className="text-lg font-bold text-gray-900 mb-3">{post.title}</h2>

            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                <Avatar initials={post.avatar} size="md" />
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm">{post.author}</span>
                        <span className={`text-xs ${levelConfig[post.level]?.color}`}>{levelConfig[post.level]?.icon} {post.level}</span>
                    </div>
                    <div className="text-xs text-gray-500">{post.reputation} rep · {post.time}</div>
                </div>
            </div>

            <p className="text-gray-700 text-sm leading-relaxed mb-4">{post.content}</p>

            <div className="flex flex-wrap gap-1 mb-4">
                {post.tags.map((tag: string) => (
                    <span key={tag} className="text-xs text-[#034AA6] bg-[#034AA6]/5 border border-[#034AA6]/20 px-2 py-0.5 rounded-full">#{tag}</span>
                ))}
            </div>

            {localReplies.length > 0 && (
                <div className="mb-4">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{localReplies.length} Replies</div>
                    <div className="space-y-3">
                        {localReplies.map(reply => (
                            <div key={reply.id} className={`rounded-lg p-3 border ${reply.isAccepted ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-100"}`}>
                                {reply.isAccepted && (
                                    <div className="flex items-center gap-1 text-emerald-600 text-xs font-semibold mb-2">
                                        <span>✓</span> Accepted Answer
                                    </div>
                                )}
                                <div className="flex items-start gap-2">
                                    <Avatar initials={reply.avatar} size="sm" />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-medium text-gray-900">{reply.author}</span>
                                            <span className={`text-xs ${levelConfig[reply.level]?.color}`}>{reply.level}</span>
                                            <span className="text-xs text-gray-500 ml-auto">{reply.time}</span>
                                        </div>
                                        <p className="text-gray-700 text-xs leading-relaxed">{reply.content}</p>
                                        <button
                                            onClick={() => setUpvoted(u => ({ ...u, [reply.id]: !u[reply.id] }))}
                                            className={`mt-2 flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors ${upvoted[reply.id] ? "text-[#034AA6] bg-[#034AA6]/10" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                                                }`}
                                        >
                                            ▲ {reply.upvotes + (upvoted[reply.id] ? 1 : 0)}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {canReply ? (
                <div className="mt-auto pt-3 border-t border-gray-100">
                    <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="Write a helpful reply..."
                        className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:border-[#034AA6] focus:ring-1 focus:ring-[#034AA6] transition-all"
                        rows={3}
                    />
                    <button
                        onClick={handleReply}
                        disabled={!replyText.trim()}
                        className="mt-2 px-4 py-2 bg-[#034AA6] hover:bg-[#0339A6] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        Post Reply
                    </button>
                </div>
            ) : (
                <div className="mt-auto pt-3 border-t border-gray-100 text-xs text-gray-500 italic">
                    This post is archived — no new replies allowed.
                </div>
            )}
        </div>
    );
}

function Analytics() {
    const stats = [
        { label: "Total Posts", value: "1,248", delta: "+12%", color: "text-[#034AA6]" },
        { label: "Resolved", value: "874", delta: "+8%", color: "text-emerald-600" },
        { label: "Active Users", value: "342", delta: "+24%", color: "text-sky-600" },
        { label: "Avg. Response Time", value: "1.4h", delta: "-18%", color: "text-amber-600" },
    ];

    const categoryStats = [
        { name: "Academic Questions", count: 562, pct: 45 },
        { name: "Study Materials", count: 436, pct: 35 },
        { name: "Lost Items", count: 250, pct: 20 },
    ];

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
                {stats.map(s => (
                    <div key={s.label} className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                        <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                        <div className={`text-xs font-medium mt-1 ${s.color}`}>{s.delta} this month</div>
                    </div>
                ))}
            </div>

            <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <div className="text-sm font-semibold text-gray-900 mb-3">Posts by Category</div>
                <div className="space-y-3">
                    {categoryStats.map(c => {
                        const col = categoryColors[c.name];
                        return (
                            <div key={c.name}>
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>{c.name}</span><span>{c.count}</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${col?.dot || "bg-gray-400"}`} style={{ width: `${c.pct}%`, opacity: 0.85 }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <div className="text-sm font-semibold text-gray-900 mb-3">Trending Tags</div>
                <div className="flex flex-wrap gap-2">
                    {trendingTags.map((tag, i) => (
                        <span key={tag} className="text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-700"
                            style={{ fontSize: `${Math.max(10, 13 - i * 0.4)}px` }}>
                            #{tag}
                        </span>
                    ))}
                </div>
            </div>

            <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <div className="text-sm font-semibold text-gray-900 mb-3">Top Contributors</div>
                <div className="space-y-2">
                    {topUsers.map((u, i) => (
                        <div key={u.name} className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                            <Avatar initials={u.avatar} size="sm" />
                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-900">{u.name}</span>
                                    <span className="text-xs text-[#034AA6] font-bold">{u.rep} rep</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs ${levelConfig[u.level]?.color}`}>{u.level}</span>
                                    <span className="text-xs text-gray-500">· {u.resolved} solved</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function NewPostModal({ onClose, onSubmit }: { onClose: () => void, onSubmit: (p: any) => void }) {
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState("Academic Questions");
    const [content, setContent] = useState("");
    const [tags, setTags] = useState("");

    return (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg shadow-xl">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <h2 className="font-bold text-gray-900">Create New Post</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1.5">Category</label>
                        <div className="flex gap-2">
                            {["Academic Questions", "Study Materials", "Lost Items"].map(cat => {
                                const c = categoryColors[cat];
                                return (
                                    <button key={cat} onClick={() => setCategory(cat)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${category === cat ? `${c.bg} ${c.text} ${c.border}` : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
                                            }`}>{cat}</button>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1.5">Title</label>
                        <input value={title} onChange={e => setTitle(e.target.value)}
                            placeholder="Describe your question or item..."
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#034AA6] focus:ring-1 focus:ring-[#034AA6] shadow-sm"
                        />
                        <SimilarPostAlert query={title} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1.5">Details</label>
                        <textarea value={content} onChange={e => setContent(e.target.value)}
                            placeholder="Add more context..."
                            rows={3}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#034AA6] focus:ring-1 focus:ring-[#034AA6] shadow-sm resize-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1.5">Tags (comma separated)</label>
                        <input value={tags} onChange={e => setTags(e.target.value)}
                            placeholder="e.g. algorithms, python, urgent"
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#034AA6] focus:ring-1 focus:ring-[#034AA6] shadow-sm"
                        />
                    </div>
                </div>
                <div className="flex gap-3 p-5 pt-0">
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm hover:bg-gray-50 transition-colors font-medium shadow-sm">Save Draft</button>
                    <button
                        onClick={() => { onSubmit({ title, category, content, tags }); onClose(); }}
                        disabled={!title.trim()}
                        className="flex-1 py-2 rounded-lg bg-[#034AA6] hover:bg-[#0339A6] disabled:opacity-40 text-white text-sm font-medium transition-colors shadow-sm"
                    >Publish Post</button>
                </div>
            </div>
        </div>
    );
}

export default function Page() {
    const [activeTab, setActiveTab] = useState("feed");
    const [selectedPost, setSelectedPost] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState("All");
    const [filterCategory, setFilterCategory] = useState("All");
    const [showNewPost, setShowNewPost] = useState(false);
    const [posts, setPosts] = useState(mockPosts);

    const filtered = posts.filter(p => {
        const matchSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.tags.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchStatus = filterStatus === "All" || p.status === filterStatus;
        const matchCat = filterCategory === "All" || p.category === filterCategory;
        return matchSearch && matchStatus && matchCat;
    });

    const handleNewPost = ({ title, category, content, tags }: any) => {
        const newPost = {
            id: Date.now(), title, category, content,
            tags: tags.split(",").map((t: string) => t.trim()).filter(Boolean),
            status: "Open", author: "You", avatar: "YO",
            reputation: 10, level: "Newcomer",
            replies: 0, upvotes: 0, time: "just now", hasAccepted: false,
        };
        setPosts(prev => [newPost, ...prev]);
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { font-family: 'Space Grotesk', sans-serif; }
        code, .mono { font-family: 'JetBrains Mono', monospace; }
        ::-webkit-scrollbar { width: 4px; } 
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
      `}</style>

            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur-md">
                <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#034AA6] to-[#0339A6] flex items-center justify-center text-white font-bold text-sm shadow-sm">U</div>
                        <div>
                            <div className="font-bold text-sm leading-tight text-gray-900">UniHub</div>
                            <div className="text-xs text-gray-500 leading-tight">Resource Exchange</div>
                        </div>
                    </div>

                    <div className="flex-1 max-w-md relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search posts, tags..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-[#034AA6] focus:ring-1 focus:ring-[#034AA6] transition-all shadow-sm"
                        />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setShowNewPost(true)}
                            className="px-3 py-1.5 bg-[#034AA6] hover:bg-[#0339A6] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                            <span>+</span> New Post
                        </button>
                        <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                            <Avatar initials="YO" size="sm" />
                            <div className="hidden sm:block">
                                <div className="text-xs font-medium text-gray-900 leading-tight">You</div>
                                <div className="text-xs text-gray-500 leading-tight">10 rep</div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 py-5">
                {/* Tab Nav */}
                <div className="flex gap-1 mb-5 bg-white p-1 rounded-xl w-fit border border-gray-200 shadow-sm">
                    {[["feed", "📋 Feed"], ["analytics", "📊 Analytics"]].map(([id, label]) => (
                        <button key={id} onClick={() => setActiveTab(id)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === id ? "bg-gray-100 text-[#034AA6] shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                }`}>{label}</button>
                    ))}
                </div>

                {activeTab === "analytics" ? (
                    <div className="max-w-2xl">
                        <Analytics />
                    </div>
                ) : (
                    <div className="flex gap-6 flex-col md:flex-row items-start">
                        {/* Left Sidebar Filters */}
                        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-8 sticky top-20">
                            {/* Status */}
                            <div>
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 px-1">Status</h3>
                                <div className="flex flex-col gap-1.5">
                                    {["All", "Open", "Resolved", "Draft", "Archived"].map(s => (
                                        <button key={s} onClick={() => setFilterStatus(s)}
                                            className={`text-left px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${filterStatus === s ? "bg-white border-gray-300 text-gray-900 shadow-sm" : "border-transparent text-gray-500 hover:bg-gray-200 hover:text-gray-700 bg-gray-100/80"
                                                }`}>{s}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Categories */}
                            <div>
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 px-1">Categories</h3>
                                <div className="flex flex-col gap-1.5">
                                    {["All", "Academic Questions", "Study Materials", "Lost Items"].map(c => {
                                        const col = categoryColors[c];
                                        return (
                                            <button key={c} onClick={() => setFilterCategory(c)}
                                                className={`text-left px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${filterCategory === c
                                                    ? col ? `${col.bg} ${col.text} ${col.border}` : "bg-white border-gray-300 text-gray-900 shadow-sm"
                                                    : "border-transparent text-gray-500 hover:bg-gray-200 bg-gray-100/80"
                                                    }`}>{c === "All" ? "All Categories" : c}</button>
                                        );
                                    })}
                                </div>
                            </div>
                        </aside>

                        {/* Middle/Right: Post List & Detail */}
                        <div className={`flex flex-col gap-4 ${selectedPost ? "w-full md:max-w-sm" : "flex-1 w-full max-w-3xl"} transition-all duration-200`}>
                            <div className="text-sm text-gray-500 font-medium px-1 flex justify-between items-center">
                                <span>{filtered.length} posts found</span>
                            </div>

                            <div className="space-y-3">
                                {filtered.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">No posts match your search.</div>
                                ) : (
                                    filtered.map(post => (
                                        <PostCard key={post.id} post={post} onClick={setSelectedPost} isActive={selectedPost?.id === post.id} />
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Right: Post Detail */}
                        {selectedPost && (
                            <div className="flex-1 min-w-0">
                                <div className="sticky top-20 bg-white border border-gray-200 shadow-sm rounded-2xl p-5 max-h-[calc(100vh-6rem)] overflow-y-auto">
                                    <PostDetail post={selectedPost} onClose={() => setSelectedPost(null)} />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {showNewPost && (
                <NewPostModal onClose={() => setShowNewPost(false)} onSubmit={handleNewPost} />
            )}
        </div>
    );
}

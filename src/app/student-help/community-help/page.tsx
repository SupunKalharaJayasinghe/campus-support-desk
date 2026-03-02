"use client";

import React, { useState } from 'react';
import {
    Search,
    MessageCircle,
    ThumbsUp,
    BarChart,
    Plus,
    User,
    BookOpen,
    Layers,
    CheckCircle2,
    Archive,
    PenTool,
    HelpCircle
} from 'lucide-react';

// --- Type Definitions ---
type PostStatus = 'Open' | 'Resolved' | 'Draft' | 'Archived';
type Category = 'Academic Questions' | 'Study Materials' | 'Lost Items' | 'General';

interface Post {
    id: string;
    title: string;
    description: string;
    author: {
        name: string;
        role: string;
        reputation: number;
        initials: string;
    };
    category: Category;
    status: PostStatus;
    tags: string[];
    upvotes: number;
    comments: number;
    timePosted: string;
}

// --- Dummy Data ---
const DUMMY_POSTS: Post[] = [
    {
        id: '1',
        title: 'How to integrate Next.js APP router with MongoDB?',
        description: "I'm having trouble figuring out the best practices for connecting MongoDB within the Next.js 14 App router. Should I use server actions or API routes?",
        author: { name: 'Alice Smith', role: 'Student', reputation: 342, initials: 'AS' },
        category: 'Academic Questions',
        status: 'Open',
        tags: ['nextjs', 'mongodb', 'react'],
        upvotes: 24,
        comments: 5,
        timePosted: '2 hours ago',
    },
    {
        id: '2',
        title: 'Calculus 101 Midterm Study Guide',
        description: "I've compiled a comprehensive study guide for the upcoming midterms covering all chapters from 1 to 5. Feel free to use and share!",
        author: { name: 'Bob Johnson', role: 'TA', reputation: 1205, initials: 'BJ' },
        category: 'Study Materials',
        status: 'Resolved',
        tags: ['calculus', 'midterm', 'math'],
        upvotes: 156,
        comments: 12,
        timePosted: '1 day ago',
    },
    {
        id: '3',
        title: 'Lost Blue Water Bottle in Library',
        description: "I lost my blue hydroflask on the 3rd floor of the main library near the quiet study section. If anyone finds it, please let me know!",
        author: { name: 'Charlie Davis', role: 'Student', reputation: 45, initials: 'CD' },
        category: 'Lost Items',
        status: 'Open',
        tags: ['lost', 'library'],
        upvotes: 2,
        comments: 0,
        timePosted: '3 hours ago',
    },
    {
        id: '4',
        title: 'Looking for a study group for Data Structures (CS201)',
        description: "We are trying to form a study group for the upcoming CS201 assignments. We meet every Tuesday and Thursday at the student center.",
        author: { name: 'Diana Prince', role: 'Student', reputation: 89, initials: 'DP' },
        category: 'General',
        status: 'Open',
        tags: ['cs201', 'study-group', 'cs'],
        upvotes: 14,
        comments: 3,
        timePosted: '5 hours ago',
    }
];

// --- Modular Components ---

const Badge = ({ children, colorClass }: { children: React.ReactNode, colorClass: string }) => (
    <span className={`px-2 py-1 text-xs font-semibold rounded-md border ${colorClass}`}>
        {children}
    </span>
);

const Tag = ({ text }: { text: string }) => (
    <span className="px-3 py-1 text-xs text-gray-600 bg-gray-100 rounded-full border border-gray-200">
        #{text}
    </span>
);

const Button = ({ children, variant = 'primary', icon, onClick, className = '' }: { children: React.ReactNode, variant?: 'primary' | 'secondary' | 'ghost', icon?: React.ReactNode, onClick?: () => void, className?: string }) => {
    const baseStyle = "flex items-center justify-center gap-2 px-4 py-2 font-medium transition-all rounded-lg";
    const variants = {
        primary: "bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/20",
        secondary: "bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 shadow-sm",
        ghost: "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
    };

    return (
        <button onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`}>
            {icon}
            {children}
        </button>
    );
};

const Sidebar = () => (
    <aside className="w-64 h-screen border-r border-gray-200 bg-white flex flex-col fixed left-0 top-0">
        <div className="p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent flex items-center gap-2">
                <Layers className="text-purple-600" size={24} />
                StudyHub
            </h1>
            <p className="text-xs text-gray-500 mt-1">Resource Exchange</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
            <div className="space-y-1">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">Menu</div>
                <Button variant="ghost" className="w-full justify-start text-purple-700 bg-purple-50 hover:bg-purple-100/70">
                    <HelpCircle size={18} />
                    Feed
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                    <BarChart size={18} />
                    Analytics
                </Button>
            </div>

            <div className="space-y-1">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">Filters</div>
                <Button variant="ghost" className="w-full justify-start">All Posts</Button>
                <Button variant="ghost" className="w-full justify-start"><CheckCircle2 size={16} /> Open</Button>
                <Button variant="ghost" className="w-full justify-start"><CheckCircle2 size={16} className="text-green-600" /> Resolved</Button>
                <Button variant="ghost" className="w-full justify-start"><PenTool size={16} /> Draft</Button>
                <Button variant="ghost" className="w-full justify-start"><Archive size={16} /> Archived</Button>
            </div>

            <div className="space-y-1">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">Categories</div>
                <Button variant="ghost" className="w-full justify-start">All Categories</Button>
                <Button variant="ghost" className="w-full justify-start items-center gap-2 text-sm"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Academic</Button>
                <Button variant="ghost" className="w-full justify-start items-center gap-2 text-sm"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Materials</Button>
                <Button variant="ghost" className="w-full justify-start items-center gap-2 text-sm"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Lost Items</Button>
                <Button variant="ghost" className="w-full justify-start items-center gap-2 text-sm"><div className="w-2 h-2 rounded-full bg-gray-500"></div> General</Button>
            </div>
        </div>

        <div className="p-4 border-t border-gray-200 text-sm text-gray-500 text-center bg-gray-50 rounded-b-xl mx-2 mb-2">
            {DUMMY_POSTS.length} posts found
        </div>
    </aside>
);

const Navbar = () => (
    <nav className="h-16 border-b border-gray-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 fixed top-0 w-[calc(100%-16rem)] left-64 z-10">
        <div className="flex-1 max-w-xl">
            <div className="relative flex items-center w-full h-10 rounded-full focus-within:ring-2 focus-within:ring-purple-500 bg-gray-100 border border-gray-200 overflow-hidden">
                <div className="grid place-items-center h-full w-12 text-gray-500">
                    <Search size={18} />
                </div>
                <input
                    className="peer h-full w-full outline-none text-sm text-gray-800 bg-transparent pr-2 placeholder-gray-500"
                    type="text"
                    id="search"
                    placeholder="Search topics, questions, or tags..." />
            </div>
        </div>
        <div className="flex items-center gap-6 ml-4">
            <Button variant="primary" icon={<Plus size={18} />} className="rounded-full px-6">
                New Post
            </Button>
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 cursor-pointer hover:border-purple-500 transition-colors">
                <User size={20} className="text-gray-600" />
            </div>
        </div>
    </nav>
);

const PostCard = ({ post, isSelected, onClick }: { post: Post, isSelected: boolean, onClick: () => void }) => {
    const getStatusColor = (status: PostStatus) => {
        return status === 'Open' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-green-50 text-green-700 border-green-200';
    };
    const getCategoryColor = (cat: Category) => {
        if (cat.includes('Academic')) return 'bg-blue-50 text-blue-700 border-blue-200';
        if (cat.includes('Materials')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (cat.includes('Lost')) return 'bg-orange-50 text-orange-700 border-orange-200';
        return 'bg-gray-50 text-gray-700 border-gray-200';
    };

    return (
        <div
            onClick={onClick}
            className={`p-5 rounded-xl border transition-all cursor-pointer group hover:border-purple-300 hover:shadow-md ${isSelected ? 'bg-purple-50/50 border-purple-400 shadow-sm' : 'bg-white border-gray-200 shadow-sm hover:shadow-md'}`}
        >
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-700 border border-gray-200">
                        {post.author.initials}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 list-none">
                            <span className="text-sm font-semibold text-gray-900">{post.author.name}</span>
                            <span className="text-xs text-gray-500">• {post.timePosted}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge colorClass={getCategoryColor(post.category)}>{post.category}</Badge>
                            <Badge colorClass={getStatusColor(post.status)}>{post.status}</Badge>
                        </div>
                    </div>
                </div>
            </div>

            <h3 className="text-lg font-bold text-gray-900 group-hover:text-purple-700 transition-colors mb-2 line-clamp-2">
                {post.title}
            </h3>

            <div className="flex flex-wrap gap-2 mt-4 mb-4">
                {post.tags.map(tag => <Tag key={tag} text={tag} />)}
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500 border-t border-gray-100 pt-4">
                <div className="flex items-center gap-1.5 hover:text-purple-600 transition-colors">
                    <ThumbsUp size={16} />
                    <span>{post.upvotes}</span>
                </div>
                <div className="flex items-center gap-1.5 hover:text-purple-600 transition-colors">
                    <MessageCircle size={16} />
                    <span>{post.comments}</span>
                </div>
            </div>
        </div>
    );
};

const PostDetail = ({ post }: { post: Post }) => {
    if (!post) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <BookOpen size={48} className="mb-4 text-gray-300" />
                <h2 className="text-xl font-semibold text-gray-900">Select a post</h2>
                <p className="text-sm text-gray-500">Choose a discussion from the feed to view details</p>
            </div>
        );
    }

    const getStatusColor = (status: PostStatus) => {
        return status === 'Open' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-green-50 text-green-700 border-green-200';
    };
    const getCategoryColor = (cat: Category) => {
        if (cat.includes('Academic')) return 'bg-blue-50 text-blue-700 border-blue-200';
        if (cat.includes('Materials')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (cat.includes('Lost')) return 'bg-orange-50 text-orange-700 border-orange-200';
        return 'bg-gray-50 text-gray-700 border-gray-200';
    };

    return (
        <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg shadow-gray-200/50">
            <div className="p-8 pb-6 border-b border-gray-200 flex-1 overflow-y-auto custom-scrollbar bg-white">
                <div className="flex items-center gap-3 mb-6">
                    <Badge colorClass={getCategoryColor(post.category)}>{post.category}</Badge>
                    <Badge colorClass={getStatusColor(post.status)}>{post.status}</Badge>
                </div>

                <h1 className="text-3xl font-extrabold text-gray-900 mb-6 leading-tight">
                    {post.title}
                </h1>

                <div className="flex items-center gap-4 mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-lg font-bold text-gray-700 border border-gray-200 shadow-sm">
                        {post.author.initials}
                    </div>
                    <div>
                        <div className="font-semibold text-gray-900">{post.author.name}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                            <span>{post.author.role}</span>
                            <span>•</span>
                            <span className="text-purple-600 font-medium flex items-center gap-1">
                                Rep: {post.author.reputation}
                            </span>
                            <span>•</span>
                            <span>{post.timePosted}</span>
                        </div>
                    </div>
                </div>

                <div className="prose max-w-none mb-8">
                    <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-wrap">
                        {post.description}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-200 pb-8">
                    {post.tags.map(tag => <Tag key={tag} text={tag} />)}
                </div>

                {/* Reply Section */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <MessageCircle size={20} className="text-purple-600" />
                        Add a Reply
                    </h3>
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-2 focus-within:border-purple-500/50 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
                        <textarea
                            rows={4}
                            placeholder="Type your response here..."
                            className="w-full bg-transparent text-gray-800 p-3 outline-none resize-none placeholder-gray-400 custom-scrollbar"
                        />
                        <div className="flex justify-end p-2 border-t border-gray-200 mt-2">
                            <Button variant="primary">Post Reply</Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Page Component ---

export default function CommunityHelpFeed() {
    const [selectedPostId, setSelectedPostId] = useState<string>(DUMMY_POSTS[0].id);

    const selectedPost = DUMMY_POSTS.find(p => p.id === selectedPostId) || DUMMY_POSTS[0];

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 font-sans selection:bg-purple-200 overflow-hidden flex flex-col">
            <Sidebar />
            <Navbar />

            <main className="ml-64 pt-16 h-screen flex">
                <div className="w-1/2 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4 border-r border-gray-200/60 bg-gray-50">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Recent Discussions</h2>
                        <div className="text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-800 transition-colors">Sort by: Newest</div>
                    </div>
                    {DUMMY_POSTS.map(post => (
                        <PostCard
                            key={post.id}
                            post={post}
                            isSelected={post.id === selectedPostId}
                            onClick={() => setSelectedPostId(post.id)}
                        />
                    ))}
                    {/* Add more spacing at bottom */}
                    <div className="h-12 flex-shrink-0"></div>
                </div>

                <div className="w-1/2 p-6 bg-[#f8f9fa] flex flex-col h-[calc(100vh-4rem)]">
                    <PostDetail post={selectedPost} />
                </div>
            </main>

            <style jsx global>{`
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 10px;
  }
  .custom-scrollbar:hover::-webkit-scrollbar-thumb {
    background-color: #94a3b8;
  }
`}</style>
        </div>
    );
}

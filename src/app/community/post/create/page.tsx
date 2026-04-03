"use client";

import Link from "next/link";
import { useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import communityBackground from "@/app/images/community/community2.jpg";
import CommunityPostComposer, {
    type CommunityPostDraftInput,
} from "@/components/community/CommunityPostComposer";
import { saveCommunityDraftApi } from "@/lib/community-draft-api";

export default function CreateCommunityPostPage() {
    const handleDraftSaved = useCallback(async (draft: CommunityPostDraftInput) => {
        return saveCommunityDraftApi(draft);
    }, []);

    return (
        <main
            className="relative min-h-screen overflow-hidden text-[#0f0f0f]"
            style={{
                backgroundImage: `url(${communityBackground.src})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
            }}
        >
            <div className="absolute inset-0 bg-slate-100/70" />
            <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
                <div className="mb-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="rounded-md bg-blue-700 px-2 py-1 text-xs font-bold text-white">
                            UNIHUB
                        </div>
                        <span className="text-lg font-bold tracking-tight text-slate-800">Create Post</span>
                    </div>
                    <Link
                        className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-200"
                        href="/community"
                    >
                        <ArrowLeft size={16} />
                        Back to Community
                    </Link>
                </div>

                <CommunityPostComposer
                    className="mx-auto w-full max-w-3xl"
                    onDraftSaved={handleDraftSaved}
                    urgentDoneNavigatesTo="/community/profile#draft-posts"
                />
            </div>
        </main>
    );
}

"use client";

import Stepper, { Step } from "@/components/community/Stepper";

type CommunityInstructionsPanelProps = {
    /** When the user finishes the last step (e.g. close a modal). */
    onFinish?: () => void;
    className?: string;
};

export default function CommunityInstructionsPanel({ onFinish, className = "" }: CommunityInstructionsPanelProps) {
    return (
        <div className={className}>
            <h2 className="text-sm font-bold text-slate-800">Community instructions</h2>
            <p className="mt-1 text-xs text-slate-600">Quick tour of how to use this page.</p>
            <div className="mt-4">
                <Stepper
                    initialStep={1}
                    onStepChange={() => {}}
                    onFinalStepCompleted={() => onFinish?.()}
                    backButtonText="Previous"
                    nextButtonText="Next"
                >
                    <Step>
                        <h3 className="text-base font-semibold text-slate-800">Welcome</h3>
                        <p className="mt-2 leading-relaxed text-slate-700">
                            This is the campus community feed. Browse posts from students and staff, filter by topic, and jump
                            to urgent items when time-sensitive posts are highlighted.
                        </p>
                    </Step>
                    <Step>
                        <h3 className="text-base font-semibold text-slate-800">Browse &amp; filter</h3>
                        <p className="mt-2 leading-relaxed text-slate-700">
                            Use the category chips for <strong className="font-semibold text-slate-800">All</strong>,{" "}
                            <strong className="font-semibold text-slate-800">Urgent</strong>, lost items, study materials, and
                            academic questions. The header search narrows posts by title and text in the list.
                        </p>
                    </Step>
                    <Step>
                        <h3 className="text-base font-semibold text-slate-800">Engage</h3>
                        <p className="mt-2 leading-relaxed text-slate-700">
                            Sign in to like posts, reply, and report content. Guests can still read the feed. Open{" "}
                            <strong className="font-semibold text-slate-800">Reply</strong> under a post to read threads and add
                            a comment.
                        </p>
                    </Step>
                    <Step>
                        <h3 className="text-base font-semibold text-slate-800">Create &amp; report</h3>
                        <p className="mt-2 leading-relaxed text-slate-700">
                            Use <strong className="font-semibold text-slate-800">Create</strong> in the top bar (or your profile)
                            to add a post. <strong className="font-semibold text-slate-800">Report</strong> opens a short
                            form—pick a reason and, if you choose Other, describe the issue.
                        </p>
                        <p className="mt-2 text-xs text-slate-600">
                            Expand <strong className="font-semibold text-slate-700">Members</strong> and{" "}
                            <strong className="font-semibold text-slate-700">Recent posts</strong> in the left sidebar when you
                            need them.
                        </p>
                    </Step>
                </Stepper>
            </div>
        </div>
    );
}

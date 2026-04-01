import { FileText } from "lucide-react";

type CommunityReplyAttachmentProps = {
    attachmentUrl: string;
    attachmentName?: string;
    /** Tailwind max-height class for inline images */
    imageClassName?: string;
};

export default function CommunityReplyAttachment({
    attachmentUrl,
    attachmentName,
    imageClassName = "max-h-40",
}: CommunityReplyAttachmentProps) {
    const isLikelyImage =
        attachmentUrl.startsWith("data:image/") ||
        (/^https?:\/\//i.test(attachmentUrl) &&
            /\.(png|jpe?g|gif|webp)(\?|$)/i.test(attachmentUrl));

    if (isLikelyImage) {
        return (
            <div className="mt-2">
                <a href={attachmentUrl} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={attachmentUrl}
                        alt=""
                        className={`rounded-lg border border-blue-100 object-contain ${imageClassName} w-full max-w-md`}
                    />
                </a>
            </div>
        );
    }

    return (
        <div className="mt-2">
            <a
                href={attachmentUrl}
                download={attachmentName || true}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline"
            >
                <FileText size={14} aria-hidden />
                {attachmentName || "View attachment"}
            </a>
        </div>
    );
}

"use client";

import { cn, getInitials } from "@/lib/utils";

type AvatarSize = "sm" | "md" | "lg" | "xl";
type AvatarStatus = "online" | "offline";

const sizeStyles: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-lg"
};

export function Avatar({
  name,
  src,
  size = "md",
  status
}: {
  name: string;
  src?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
}) {
  return (
    <div className="relative inline-flex">
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-full bg-indigo-100 font-semibold text-indigo-700",
          sizeStyles[size]
        )}
      >
        {src ? (
          <img src={src} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </div>
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white",
            status === "online" ? "bg-green-500" : "bg-slate-400"
          )}
          aria-label={status}
        />
      )}
    </div>
  );
}

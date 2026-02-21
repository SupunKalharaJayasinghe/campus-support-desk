"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

type TooltipPosition = "top" | "bottom" | "left" | "right";

export function Tooltip({
  content,
  position = "top",
  delay = 200,
  children
}: {
  content: string;
  position?: TooltipPosition;
  delay?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<number | undefined>();

  const show = () => {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setOpen(true), delay);
  };

  const hide = () => {
    window.clearTimeout(timeoutRef.current);
    setOpen(false);
  };

  const positionClasses: Record<TooltipPosition, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2"
  };

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {open && (
        <span
          className={cn(
            "absolute z-30 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow-sm",
            positionClasses[position]
          )}
          role="tooltip"
        >
          {content}
        </span>
      )}
    </span>
  );
}

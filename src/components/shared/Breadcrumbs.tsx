"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { toTitleCase } from "@/lib/utils";

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    return {
      label: toTitleCase(segment.replace(/\[(.+)\]/, "$1")),
      href
    };
  });

  return (
    <nav className="flex items-center gap-2 text-xs text-slate-500">
      <Link href="/" className="hover:text-indigo-600">
        Home
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-2">
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <Link href={crumb.href} className="hover:text-indigo-600">
            {crumb.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}

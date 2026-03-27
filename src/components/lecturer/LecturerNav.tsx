"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearDemoSession } from "@/lib/rbac";

const NAV_LINKS = [
  { href: "/lecturer", label: "Dashboard" },
  { href: "/lecturer/availability", label: "Availability" },
  { href: "/lecturer/bookings", label: "Bookings" },
  { href: "/lecturer/notifications", label: "Notifications" },
  { href: "/lecturer/posts", label: "Posts" },
];

export default function LecturerNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav>
      <div className="nav-brand">
        Uni<span>Hub</span>
      </div>
      <ul className="nav-links">
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href;
          return (
            <li key={link.href}>
              <Link className={isActive ? "active" : ""} href={link.href}>
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="nav-right">
        <div className="ai-chip">AI Active</div>
        <button
          className="btn-ghost"
          onClick={() => {
            clearDemoSession();
            router.push("/login");
          }}
          type="button"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}

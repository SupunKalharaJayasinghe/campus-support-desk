"use client";

import {
  LayoutDashboard,
  Package,
  ClipboardList,
  CheckCircle,
  Handshake,
  RotateCcw,
  User
} from "lucide-react";
import { Sidebar, NavItem } from "@/components/layouts/Sidebar";

export function LostItemStaffSidebar() {
  const items: NavItem[] = [
    {
      label: "Dashboard",
      href: "/lost-item-staff",
      icon: <LayoutDashboard className="h-4 w-4" />
    },
    {
      label: "All Items",
      href: "/lost-item-staff/items",
      icon: <Package className="h-4 w-4" />
    },
    {
      label: "Pending Review",
      href: "/lost-item-staff/items/pending",
      icon: <ClipboardList className="h-4 w-4" />
    },
    {
      label: "Approved Items",
      href: "/lost-item-staff/items/approved",
      icon: <CheckCircle className="h-4 w-4" />
    },
    {
      label: "Claimed Items",
      href: "/lost-item-staff/items/claimed",
      icon: <Handshake className="h-4 w-4" />
    },
    {
      label: "Returned Items",
      href: "/lost-item-staff/items/returned",
      icon: <RotateCcw className="h-4 w-4" />
    },
    {
      label: "Profile",
      href: "/lost-item-staff/profile",
      icon: <User className="h-4 w-4" />
    }
  ];

  return <Sidebar items={items} logo="Lost Item Staff" />;
}

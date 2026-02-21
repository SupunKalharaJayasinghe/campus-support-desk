"use client";

import { Users, BookOpen, Package, Bell } from "lucide-react";
import { StatsCard } from "@/components/shared/StatsCard";
import { mockStats } from "@/lib/mock-data";

const icons = [<Users key="u" className="h-4 w-4" />, <BookOpen key="b" className="h-4 w-4" />, <Package key="p" className="h-4 w-4" />, <Bell key="n" className="h-4 w-4" />];

export function StatsGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {mockStats.map((stat, index) => (
        <StatsCard
          key={stat.title}
          title={stat.title}
          value={stat.value}
          change={stat.change}
          icon={icons[index]}
          trend={stat.change.startsWith("-") ? "down" : "up"}
        />
      ))}
    </div>
  );
}

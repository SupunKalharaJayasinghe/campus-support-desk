"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type TabItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
};

export function Tabs({
  items,
  activeId,
  onChange,
  className
}: {
  items: TabItem[];
  activeId?: string;
  onChange?: (id: string) => void;
  className?: string;
}) {
  const [internalId, setInternalId] = useState(items[0]?.id);
  const currentId = activeId ?? internalId;

  const handleChange = (id: string) => {
    setInternalId(id);
    onChange?.(id);
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((item) => {
        const isActive = item.id === currentId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleChange(item.id)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
              isActive
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

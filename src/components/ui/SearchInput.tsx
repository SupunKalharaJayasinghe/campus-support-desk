"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  debounce = 300,
  className
}: {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  debounce?: number;
  className?: string;
}) {
  const [internalValue, setInternalValue] = useState(value ?? "");

  useEffect(() => {
    setInternalValue(value ?? "");
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      onChange?.(internalValue);
    }, debounce);
    return () => clearTimeout(handler);
  }, [internalValue, onChange, debounce]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm",
        className
      )}
    >
      <Search className="h-4 w-4 text-slate-400" />
      <input
        className="w-full bg-transparent outline-none placeholder:text-slate-400"
        value={internalValue}
        onChange={(event) => setInternalValue(event.target.value)}
        placeholder={placeholder}
        aria-label="Search"
      />
      {internalValue && (
        <button
          type="button"
          onClick={() => setInternalValue("")}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

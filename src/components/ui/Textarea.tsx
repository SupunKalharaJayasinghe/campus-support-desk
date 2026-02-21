"use client";

import React, { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helper?: string;
  showCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helper,
      className,
      id,
      maxLength,
      showCount = true,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          maxLength={maxLength}
          className={cn(
            "min-h-[120px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200",
            props.disabled && "bg-slate-100 text-slate-400",
            error && "border-red-300 focus:border-red-500 focus:ring-red-200",
            className
          )}
          {...props}
        />
        <div className="flex items-center justify-between text-xs">
          <span className={error ? "text-red-500" : "text-slate-500"}>
            {error ?? helper}
          </span>
          {showCount && maxLength && (
            <span className="text-slate-400">
              {(props.value?.toString().length ?? 0)}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

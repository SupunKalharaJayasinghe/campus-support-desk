"use client";

import React, { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helper,
      prefix,
      suffix,
      className,
      id,
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
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200",
            props.disabled && "bg-slate-100 text-slate-400",
            error && "border-red-300 focus-within:border-red-500 focus-within:ring-red-200"
          )}
        >
          {prefix && <span className="text-slate-400">{prefix}</span>}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-slate-400",
              className
            )}
            {...props}
          />
          {suffix && <span className="text-slate-400">{suffix}</span>}
        </div>
        {helper && !error && (
          <p className="text-xs text-slate-500">{helper}</p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

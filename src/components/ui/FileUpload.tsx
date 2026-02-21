"use client";

import React, { useCallback, useId, useMemo, useState } from "react";
import { UploadCloud, X, FileText, Image as ImageIcon } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/ProgressBar";

export interface FileUploadProps {
  label?: string;
  value?: File[];
  onChange?: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  maxFiles?: number;
  error?: string;
  helper?: string;
}

export function FileUpload({
  label,
  value = [],
  onChange,
  multiple,
  accept,
  maxFiles = 5,
  error,
  helper
}: FileUploadProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);

  const previews = useMemo(
    () =>
      value.map((file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
        url: file.type.startsWith("image/") ? URL.createObjectURL(file) : ""
      })),
    [value]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const nextFiles = Array.from(files);
      const merged = multiple ? [...value, ...nextFiles] : nextFiles.slice(0, 1);
      onChange?.(merged.slice(0, maxFiles));
    },
    [multiple, onChange, value, maxFiles]
  );

  const handleRemove = (name: string) => {
    onChange?.(value.filter((file) => file.name !== name));
  };

  return (
    <div className="flex w-full flex-col gap-2">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <label
        htmlFor={inputId}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-600 transition",
          isDragging && "border-indigo-400 bg-indigo-50"
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <UploadCloud className="h-6 w-6 text-indigo-500" />
        <div>
          <p className="font-medium text-slate-700">Drag and drop files here</p>
          <p className="text-xs text-slate-500">or click to browse</p>
        </div>
        {accept && (
          <p className="text-xs text-slate-400">Accepted: {accept}</p>
        )}
        <input
          id={inputId}
          type="file"
          className="hidden"
          multiple={multiple}
          accept={accept}
          onChange={(event) => handleFiles(event.target.files)}
        />
      </label>
      {helper && !error && <p className="text-xs text-slate-500">{helper}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="space-y-3">
        {previews.map((file) => (
          <div
            key={file.name}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                {file.url ? (
                  <img
                    src={file.url}
                    alt={file.name}
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                ) : file.type ? (
                  <FileText className="h-5 w-5 text-slate-500" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-slate-500" />
                )}
              </div>
              <div>
                <p className="font-medium text-slate-700">{file.name}</p>
                <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24">
                <ProgressBar value={100} />
              </div>
              <button
                type="button"
                onClick={() => handleRemove(file.name)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

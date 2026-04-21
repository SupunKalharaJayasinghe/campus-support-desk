"use client";

import { type FormEvent, useCallback, useEffect, useId, useMemo, useState } from "react";
import { Paperclip, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/ToastProvider";
import {
  createStudentTicketRemote,
  type StudentTicket,
  type StudentTicketPriority,
  type TicketEvidence,
} from "@/lib/support-ticket-client";

const MAX_EVIDENCE_FILES = 5;
const MAX_FILE_BYTES = 512 * 1024;
const ACCEPT = "image/*,.pdf,application/pdf";
const TITLE_SUGGESTIONS_BY_CATEGORY: Record<string, string[]> = {
  Technical: [
    "Wi-Fi not working in room",
    "Unable to log in to student portal",
    "Projector not turning on",
    "Lab computer is very slow",
  ],
  Academic: [
    "Need clarification about assignment deadline",
    "Cannot access course materials",
    "Issue with grade shown on portal",
    "Request appointment with lecturer",
  ],
  Booking: [
    "Consultation booking not confirmed",
    "Need to reschedule my consultation",
    "Lab booking request",
    "Room booking issue",
  ],
  "Lost item": [
    "Lost student ID card",
    "Lost wallet in campus",
    "Lost laptop charger",
    "Missing notebook from classroom",
  ],
  Other: [
    "Need general support",
    "Campus facility request",
    "Feedback about student service",
    "Other issue requiring assistance",
  ],
};

function readFileAsEvidence(file: File): Promise<TicketEvidence> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file"));
        return;
      }
      const comma = result.indexOf(",");
      const base64 = comma >= 0 ? result.slice(comma + 1) : result;
      const mimeType =
        file.type.trim() ||
        (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
      resolve({
        fileName: file.name.slice(0, 255),
        mimeType: mimeType.slice(0, 120),
        data: base64.replace(/\s+/g, ""),
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

type PendingFile = {
  key: string;
  file: File;
};

function generateKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `f_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
};

export default function CreateTicketModal({ open, onClose, onCreated }: Props) {
  const { toast } = useToast();
  const titleId = useId();
  const titleSuggestionListId = useId();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Technical");
  const [description, setDescription] = useState("");
  const [preferredContactType, setPreferredContactType] =
    useState<NonNullable<StudentTicket["preferredContactType"]>>("Phone");
  const [contactDetails, setContactDetails] = useState("");
  const [priority, setPriority] = useState<StudentTicketPriority>("Medium");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const titleSuggestions = useMemo(() => {
    const categorySuggestions = TITLE_SUGGESTIONS_BY_CATEGORY[category] ?? [];
    const typed = title.trim().toLowerCase();
    if (!typed) {
      return categorySuggestions.slice(0, 4);
    }
    return categorySuggestions
      .filter((item) => item.toLowerCase().includes(typed))
      .slice(0, 4);
  }, [category, title]);

  const reset = useCallback(() => {
    setTitle("");
    setCategory("Technical");
    setDescription("");
    setPreferredContactType("Phone");
    setContactDetails("");
    setPriority("Medium");
    setPendingFiles([]);
    setErrors({});
  }, []);

  useEffect(() => {
    if (open) {
      reset();
    }
  }, [open, reset]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!title.trim()) {
      next.title = "Title is required.";
    }
    if (!description.trim()) {
      next.description = "Description is required.";
    }
    if (!contactDetails.trim()) {
      next.contactDetails = "Contact details are required.";
    }
    return next;
  }

  async function onFilesSelected(files: FileList | null) {
    if (!files?.length) {
      return;
    }
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.files;
      return copy;
    });
    const next: PendingFile[] = [...pendingFiles];
    for (let i = 0; i < files.length; i += 1) {
      const file = files.item(i);
      if (!file) {
        continue;
      }
      if (next.length >= MAX_EVIDENCE_FILES) {
        setErrors((p) => ({
          ...p,
          files: `You can attach at most ${MAX_EVIDENCE_FILES} files.`,
        }));
        break;
      }
      if (file.size > MAX_FILE_BYTES) {
        setErrors((p) => ({
          ...p,
          files: `"${file.name}" is too large (max ${Math.round(MAX_FILE_BYTES / 1024)} KB per file).`,
        }));
        continue;
      }
      const isImg = file.type.startsWith("image/");
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isImg && !isPdf) {
        setErrors((p) => ({
          ...p,
          files: "Only images and PDF files can be attached.",
        }));
        continue;
      }
      next.push({ key: generateKey(), file });
    }
    setPendingFiles(next);
  }

  function removePending(key: string) {
    setPendingFiles((prev) => prev.filter((p) => p.key !== key));
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.files;
      return copy;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setSubmitting(true);
    try {
      let evidence: TicketEvidence[] | undefined;
      if (pendingFiles.length > 0) {
        evidence = await Promise.all(pendingFiles.map((p) => readFileAsEvidence(p.file)));
      }
      await createStudentTicketRemote({
        subject: title.trim(),
        category,
        description: description.trim(),
        preferredContactType,
        contactDetails: contactDetails.trim(),
        priority,
        ...(evidence?.length ? { evidence } : {}),
      });
      await onCreated();
      reset();
      onClose();
      toast({
        title: "Ticket created",
        message: "Your request and evidence were saved.",
      });
    } catch (error) {
      toast({
        title: "Could not create ticket",
        message:
          error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-hidden bg-slate-950/45 px-4 pb-4 pt-16 backdrop-blur-[2px] sm:px-6 sm:pb-6 sm:pt-12"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        className="relative z-10 my-4 flex max-h-[calc(100dvh-6rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-xl sm:my-6 sm:max-h-[calc(100dvh-7rem)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-heading">
              New ticket
            </h2>
            <p className="mt-0.5 text-sm text-text/70">Describe the issue so staff can help.</p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-transparent p-2 text-text/70 transition-colors hover:border-border hover:bg-tint hover:text-heading"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4"
          noValidate
          onSubmit={onSubmit}
        >
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-heading" htmlFor="modal-ticket-title">
                Title
              </label>
              <Input
                id="modal-ticket-title"
                list={titleSuggestionListId}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary"
                value={title}
                autoFocus
              />
              {titleSuggestions.length > 0 ? (
                <datalist id={titleSuggestionListId}>
                  {titleSuggestions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              ) : null}
              {errors.title ? (
                <p className="mt-1 text-xs text-primaryHover">{errors.title}</p>
              ) : null}
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-medium text-heading"
                htmlFor="modal-ticket-category"
              >
                Category
              </label>
              <Select
                id="modal-ticket-category"
                onChange={(e) => setCategory(e.target.value)}
                value={category}
              >
                <option value="Technical">Technical</option>
                <option value="Academic">Academic</option>
                <option value="Booking">Booking</option>
                <option value="Lost item">Lost item</option>
                <option value="Other">Other</option>
              </Select>
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-medium text-heading"
                htmlFor="modal-ticket-description"
              >
                Description
              </label>
              <Textarea
                id="modal-ticket-description"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened, and what do you need?"
                value={description}
                rows={4}
              />
              {errors.description ? (
                <p className="mt-1 text-xs text-primaryHover">{errors.description}</p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  className="mb-2 block text-sm font-medium text-heading"
                  htmlFor="modal-ticket-contact-type"
                >
                  Preferred contact type
                </label>
                <Select
                  id="modal-ticket-contact-type"
                  onChange={(e) =>
                    setPreferredContactType(
                      e.target.value as NonNullable<StudentTicket["preferredContactType"]>
                    )
                  }
                  value={preferredContactType}
                >
                  <option value="Phone">Phone</option>
                  <option value="Email">Email</option>
                  <option value="WhatsApp">WhatsApp</option>
                </Select>
              </div>
              <div>
                <label
                  className="mb-2 block text-sm font-medium text-heading"
                  htmlFor="modal-ticket-contact-details"
                >
                  Contact details
                </label>
                <Input
                  id="modal-ticket-contact-details"
                  onChange={(e) => setContactDetails(e.target.value)}
                  placeholder="Phone number or email"
                  value={contactDetails}
                />
                {errors.contactDetails ? (
                  <p className="mt-1 text-xs text-primaryHover">{errors.contactDetails}</p>
                ) : null}
              </div>
            </div>

            <fieldset>
              <legend className="mb-2 block text-sm font-medium text-heading">Priority</legend>
              <div className="flex flex-wrap gap-3">
                {(["Low", "Medium", "High"] as const).map((level) => (
                  <label
                    className="student-soft-card inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text"
                    key={level}
                  >
                    <input
                      checked={priority === level}
                      className="h-4 w-4 accent-primary"
                      name="priority"
                      onChange={() => setPriority(level)}
                      type="radio"
                    />
                    {level}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <p className="mb-2 text-sm font-medium text-heading">Evidence (optional)</p>
              <p className="mb-2 text-xs text-text/65">
                Attach images or PDFs (up to {MAX_EVIDENCE_FILES} files,{" "}
                {Math.round(MAX_FILE_BYTES / 1024)} KB each).
              </p>
              <label className="student-soft-card flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-tint/40 px-4 py-6 text-center transition-colors hover:border-primary/35 hover:bg-tint">
                <Paperclip className="h-5 w-5 text-text/60" aria-hidden />
                <span className="text-sm font-medium text-heading">Add evidence</span>
                <span className="text-xs text-text/60">Drag-ready — click to choose files</span>
                <input
                  className="sr-only"
                  accept={ACCEPT}
                  disabled={pendingFiles.length >= MAX_EVIDENCE_FILES || submitting}
                  multiple
                  onChange={(e) => void onFilesSelected(e.target.files)}
                  type="file"
                />
              </label>
              {errors.files ? (
                <p className="mt-2 text-xs text-primaryHover">{errors.files}</p>
              ) : null}
              {pendingFiles.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {pendingFiles.map((p) => (
                    <li
                      className="student-soft-card flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                      key={p.key}
                    >
                      <span className="min-w-0 truncate text-text">{p.file.name}</span>
                      <button
                        type="button"
                        className="shrink-0 rounded-lg p-1 text-text/60 hover:bg-tint hover:text-heading"
                        onClick={() => removePending(p.key)}
                        aria-label={`Remove ${p.file.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
            <Button
              className="rounded-full px-5"
              disabled={submitting}
              onClick={onClose}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              className="rounded-full bg-[#034aa6] px-5 text-white hover:bg-[#033d8a]"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Creating…" : "Create ticket"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

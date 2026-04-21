"use client";

import { Loader2, Paperclip, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useId, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/ToastProvider";
import {
  createStudentTicketRemote,
  type StudentTicketPriority,
  type TicketEvidence,
} from "@/lib/support-ticket-client";

const MAX_EVIDENCE_FILES = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/*,.pdf,application/pdf";
const TITLE_MIN_LENGTH = 5;
const DESCRIPTION_MIN_LENGTH = 20;
const CATEGORY_OPTIONS = ["Academic", "Technical", "Facility", "Finance", "Transport", "Other"] as const;
type CategoryOption = (typeof CATEGORY_OPTIONS)[number];
const SUBCATEGORY_OPTIONS: Record<CategoryOption, string[]> = {
  Academic: ["Exams", "Assignments", "Lectures", "Class", "Marks", "Subject", "Other"],
  Technical: ["Login", "Error", "Bug", "System", "Website", "Crash", "Other"],
  Finance: ["Fees", "Scholarship", "Refund", "Payment issue", "Other"],
  Facility: ["Classroom", "Library", "Laboratory", "Campus maintenance", "Other"],
  Transport: ["Bus pass", "Route issue", "Timing issue", "Driver complaint", "Other"],
  Other: ["General inquiry", "Complaint", "Suggestion"],
};
const TITLE_SUGGESTIONS_BY_CATEGORY: Record<CategoryOption, string[]> = {
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
  Finance: [
    "Tuition fee payment issue",
    "Scholarship amount not received",
    "Need invoice for semester fees",
    "Refund request status",
  ],
  Facility: [
    "Classroom air-conditioner not working",
    "Library seating issue",
    "Lab equipment maintenance request",
    "Campus lighting issue",
  ],
  Transport: [
    "Bus pass not activated",
    "Campus bus timing issue",
    "Transport route clarification",
    "Complaint about bus service",
  ],
  Other: [
    "Need general support",
    "Campus facility request",
    "Feedback about student service",
    "Other issue requiring assistance",
  ],
};
const CATEGORY_KEYWORDS: Record<CategoryOption, string[]> = {
  Academic: ["exam", "assignment", "lecture", "class", "marks", "subject"],
  Technical: ["login", "error", "bug", "system", "website", "crash"],
  Finance: ["payment", "fee", "refund", "card", "transaction"],
  Facility: ["classroom", "library", "lab", "maintenance", "facility", "water", "electricity"],
  Transport: ["bus", "shuttle", "transport", "route", "parking"],
  Other: [],
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
  const [category, setCategory] = useState<CategoryOption | "">("");
  const [subcategory, setSubcategory] = useState("");
  const [debouncedTitle, setDebouncedTitle] = useState("");
  const [suggestedCategory, setSuggestedCategory] = useState<CategoryOption | null>(null);
  const [categoryManuallyChanged, setCategoryManuallyChanged] = useState(false);
  const [categoryAutoSelected, setCategoryAutoSelected] = useState(false);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<StudentTicketPriority>("Medium");
  const [contactEmailEnabled, setContactEmailEnabled] = useState(false);
  const [contactPhoneEnabled, setContactPhoneEnabled] = useState(false);
  const [contactWhatsappEnabled, setContactWhatsappEnabled] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactWhatsapp, setContactWhatsapp] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const detectCategoryFromTitle = useCallback((rawTitle: string): CategoryOption | null => {
    const text = rawTitle.trim().toLowerCase();
    if (!text) {
      return null;
    }
    const scores = new Map<CategoryOption, number>();
    for (const option of CATEGORY_OPTIONS) {
      scores.set(option, 0);
    }
    for (const [option, words] of Object.entries(CATEGORY_KEYWORDS) as Array<[CategoryOption, string[]]>) {
      if (option === "Other") {
        continue;
      }
      let score = 0;
      for (const word of words) {
        if (text.includes(word)) {
          score += 1;
        }
      }
      scores.set(option, score);
    }
    let best: CategoryOption | null = null;
    let bestScore = 0;
    for (const option of CATEGORY_OPTIONS) {
      const score = scores.get(option) ?? 0;
      if (score > bestScore) {
        best = option;
        bestScore = score;
      }
    }
    return bestScore > 0 ? best : null;
  }, []);

  const titleSuggestions = useMemo(() => {
    const effectiveCategory = category || suggestedCategory;
    const categorySuggestions = effectiveCategory
      ? (TITLE_SUGGESTIONS_BY_CATEGORY[effectiveCategory] ?? [])
      : [];
    const typed = title.trim().toLowerCase();
    if (!typed) {
      return categorySuggestions.slice(0, 4);
    }
    return categorySuggestions
      .filter((item) => item.toLowerCase().includes(typed))
      .slice(0, 4);
  }, [category, suggestedCategory, title]);

  const descriptionCount = description.trim().length;
  const atLeastOneContactEnabled =
    contactEmailEnabled || contactPhoneEnabled || contactWhatsappEnabled;

  const reset = useCallback(() => {
    setTitle("");
    setCategory("");
    setSubcategory("");
    setDebouncedTitle("");
    setSuggestedCategory(null);
    setCategoryManuallyChanged(false);
    setCategoryAutoSelected(false);
    setDescription("");
    setPriority("Medium");
    setContactEmailEnabled(false);
    setContactPhoneEnabled(false);
    setContactWhatsappEnabled(false);
    setContactEmail("");
    setContactPhone("");
    setContactWhatsapp("");
    setPendingFiles([]);
    setSelectedFileNames([]);
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

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setDebouncedTitle(title);
    }, 400);
    return () => window.clearTimeout(timerId);
  }, [title]);

  useEffect(() => {
    const detected = detectCategoryFromTitle(debouncedTitle);
    setSuggestedCategory(detected);
    if (!categoryManuallyChanged && detected) {
      setCategory(detected);
      setSubcategory((current) =>
        current && SUBCATEGORY_OPTIONS[detected].includes(current)
          ? current
          : (SUBCATEGORY_OPTIONS[detected][0] ?? "")
      );
      setCategoryAutoSelected(true);
    }
  }, [categoryManuallyChanged, debouncedTitle, detectCategoryFromTitle]);

  if (!open) {
    return null;
  }

  function validate() {
    const next: Record<string, string> = {};
    const titleTrimmed = title.trim();
    if (!titleTrimmed) {
      next.title = "Title is required.";
    } else if (titleTrimmed.length < TITLE_MIN_LENGTH) {
      next.title = `Title must be at least ${TITLE_MIN_LENGTH} characters.`;
    }
    if (!category) {
      next.category = "Please select a category.";
    }
    if (!subcategory) {
      next.subcategory = "Please select a subcategory.";
    }
    const descriptionTrimmed = description.trim();
    if (!descriptionTrimmed) {
      next.description = "Description is required.";
    } else if (descriptionTrimmed.length < DESCRIPTION_MIN_LENGTH) {
      next.description = `Description must be at least ${DESCRIPTION_MIN_LENGTH} characters.`;
    }
    if (!atLeastOneContactEnabled) {
      next.contacts = "Select at least one contact option (email, phone, or WhatsApp).";
    }
    if (contactEmailEnabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      next.contactEmail = "Enter a valid email address.";
    }
    if (contactPhoneEnabled && !/^\d{10}$/.test(contactPhone.trim())) {
      next.contactPhone = "Phone number must be exactly 10 digits.";
    }
    if (contactWhatsappEnabled && !/^\d{10}$/.test(contactWhatsapp.trim())) {
      next.contactWhatsapp = "WhatsApp number must be exactly 10 digits.";
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
          files: `"${file.name}" is too large (max ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB per file).`,
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
    setSelectedFileNames(next.map((item) => item.file.name));
  }

  function removePending(key: string) {
    const next = pendingFiles.filter((p) => p.key !== key);
    setPendingFiles(next);
    setSelectedFileNames(next.map((item) => item.file.name));
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
        subcategory,
        description: description.trim(),
        ...(contactEmailEnabled ? { contactEmail: contactEmail.trim() } : {}),
        ...(contactPhoneEnabled ? { contactPhone: contactPhone.trim() } : {}),
        ...(contactWhatsappEnabled ? { contactWhatsapp: contactWhatsapp.trim() } : {}),
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
                <span className="ml-0.5 text-red-600" aria-hidden="true">
                  *
                </span>
              </label>
              <Input
                id="modal-ticket-title"
                aria-invalid={Boolean(errors.title)}
                aria-required
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
              {suggestedCategory ? (
                <p className="mt-1 text-xs text-text/70">
                  Suggested category: <span className="font-medium text-heading">{suggestedCategory}</span>
                </p>
              ) : null}
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-medium text-heading"
                htmlFor="modal-ticket-category"
              >
                Category
                <span className="ml-0.5 text-red-600" aria-hidden="true">
                  *
                </span>
              </label>
              <Select
                aria-invalid={Boolean(errors.category)}
                aria-required
                className={categoryAutoSelected ? "ring-2 ring-primary/35 transition-all duration-300" : ""}
                id="modal-ticket-category"
                onChange={(e) => {
                  const nextCategory = e.target.value as CategoryOption | "";
                  setCategoryManuallyChanged(true);
                  setCategoryAutoSelected(false);
                  setCategory(nextCategory);
                  setSubcategory(nextCategory ? (SUBCATEGORY_OPTIONS[nextCategory][0] ?? "Other") : "");
                }}
                value={category}
              >
                <option value="">Select category</option>
                <option value="Academic">Academic</option>
                <option value="Technical">Technical</option>
                <option value="Finance">Finance</option>
                <option value="Facility">Facility</option>
                <option value="Transport">Transport</option>
                <option value="Other">Other</option>
              </Select>
              {errors.category ? <p className="mt-1 text-xs text-primaryHover">{errors.category}</p> : null}
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-medium text-heading"
                htmlFor="modal-ticket-subcategory"
              >
                Subcategory
                <span className="ml-0.5 text-red-600" aria-hidden="true">
                  *
                </span>
              </label>
              <Select
                aria-invalid={Boolean(errors.subcategory)}
                aria-required
                id="modal-ticket-subcategory"
                onChange={(e) => setSubcategory(e.target.value)}
                value={subcategory}
                disabled={!category}
              >
                <option value="">{category ? "Select subcategory" : "Select category first"}</option>
                {(category ? SUBCATEGORY_OPTIONS[category] : []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
              {errors.subcategory ? (
                <p className="mt-1 text-xs text-primaryHover">{errors.subcategory}</p>
              ) : null}
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-medium text-heading"
                htmlFor="modal-ticket-description"
              >
                Description
                <span className="ml-0.5 text-red-600" aria-hidden="true">
                  *
                </span>
              </label>
              <Textarea
                aria-invalid={Boolean(errors.description)}
                aria-required
                id="modal-ticket-description"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened, and what do you need?"
                value={description}
                rows={4}
              />
              <p className="mt-1 text-right text-[11px] text-text/60">
                {descriptionCount} characters
              </p>
              {errors.description ? (
                <p className="mt-1 text-xs text-primaryHover">{errors.description}</p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-border bg-slate-50/50 p-4">
              <p className="mb-3 text-sm font-medium text-heading">
                Contact information
                <span className="ml-0.5 text-red-600" aria-hidden="true">
                  *
                </span>
              </p>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-text">
                  <input
                    checked={contactEmailEnabled}
                    className="h-4 w-4 accent-primary"
                    onChange={(e) => setContactEmailEnabled(e.target.checked)}
                    type="checkbox"
                  />
                  Email
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-text">
                  <input
                    checked={contactPhoneEnabled}
                    className="h-4 w-4 accent-primary"
                    onChange={(e) => setContactPhoneEnabled(e.target.checked)}
                    type="checkbox"
                  />
                  Phone Number
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-text">
                  <input
                    checked={contactWhatsappEnabled}
                    className="h-4 w-4 accent-primary"
                    onChange={(e) => setContactWhatsappEnabled(e.target.checked)}
                    type="checkbox"
                  />
                  WhatsApp Number
                </label>
              </div>
              {errors.contacts ? <p className="mt-2 text-xs text-primaryHover">{errors.contacts}</p> : null}
              <div className="mt-3 space-y-3">
                <div
                  className={`grid overflow-hidden transition-all duration-300 ${
                    contactEmailEnabled ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div>
                    <Input
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="Email address"
                      type="email"
                      value={contactEmail}
                    />
                    {errors.contactEmail ? (
                      <p className="mt-1 text-xs text-primaryHover">{errors.contactEmail}</p>
                    ) : null}
                  </div>
                </div>
                <div
                  className={`grid overflow-hidden transition-all duration-300 ${
                    contactPhoneEnabled ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div>
                    <Input
                      inputMode="numeric"
                      maxLength={10}
                      onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="Phone number (10 digits)"
                      value={contactPhone}
                    />
                    {errors.contactPhone ? (
                      <p className="mt-1 text-xs text-primaryHover">{errors.contactPhone}</p>
                    ) : null}
                  </div>
                </div>
                <div
                  className={`grid overflow-hidden transition-all duration-300 ${
                    contactWhatsappEnabled ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div>
                    <Input
                      inputMode="numeric"
                      maxLength={10}
                      onChange={(e) =>
                        setContactWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                      placeholder="WhatsApp number (10 digits)"
                      value={contactWhatsapp}
                    />
                    {errors.contactWhatsapp ? (
                      <p className="mt-1 text-xs text-primaryHover">{errors.contactWhatsapp}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <fieldset>
              <legend className="mb-2 block text-sm font-medium text-heading">
                Priority
                <span className="ml-0.5 text-red-600" aria-hidden="true">
                  *
                </span>
              </legend>
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
                {Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB each).
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
              {selectedFileNames.length > 0 ? (
                <p className="mt-2 text-xs text-text/70">
                  Selected: {selectedFileNames.join(", ")}
                </p>
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
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </span>
              ) : (
                "Create ticket"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

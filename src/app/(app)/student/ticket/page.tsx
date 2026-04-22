"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Paperclip, Plus, Search, Ticket, X } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/ToastProvider";
import {
  loadStudentTickets,
  type StudentTicket,
  type TicketEvidence,
  updateStudentTicketRemote,
  withdrawStudentTicketRemote,
} from "@/lib/support-ticket-client";
import CreateTicketModal from "./CreateTicketModal";
import { TICKET_CATEGORY_OPTIONS } from "@/lib/ticket-category-options";
import academicTicketImage from "@/app/images/tickets/9.jpg";
import technicalTicketImage from "@/app/images/tickets/7.jpg";
import financeTicketImage from "@/app/images/tickets/6.jpg";
import facilityTicketImage from "@/app/images/tickets/3.jpg";
import transportTicketImage from "@/app/images/tickets/8.jpg";
import otherTicketImage from "@/app/images/tickets/10.jpg";

const CATEGORY_FILTER_OPTIONS = TICKET_CATEGORY_OPTIONS;

const PRIORITY_FILTER_OPTIONS = ["Low", "Medium", "High"] as const;
const EDIT_SUBCATEGORY_OPTIONS: Record<string, string[]> = {
  Academic: ["Exams", "Assignments", "Lectures", "Attendance", "Other"],
  Technical: ["Portal login", "LMS issue", "Wi-Fi", "Lab system", "Other"],
  Facility: ["Classroom", "Library", "Laboratory", "Campus maintenance", "Other"],
  Finance: ["Fees", "Scholarship", "Refund", "Payment issue", "Other"],
  Transport: ["Bus pass", "Route issue", "Timing issue", "Driver complaint", "Other"],
  Other: ["General inquiry", "Complaint", "Suggestion"],
};
const WITHDRAW_REASONS = [
  "Issue solved by myself",
  "Created by mistake",
  "No longer needed",
  "Duplicate ticket",
  "Other",
] as const;
const MAX_EVIDENCE_FILES = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPT_EVIDENCE = "image/*,.pdf,application/pdf";

type PendingFile = {
  key: string;
  file: File;
};

function generateKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `f_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function statusBadgeVariant(status: StudentTicket["status"]) {
  if (status === "Resolved") {
    return "success" as const;
  }
  if (status === "In progress") {
    return "warning" as const;
  }
  if (status === "Withdrawn") {
    return "neutral" as const;
  }
  if (status === "Accepted") {
    return "primary" as const;
  }
  return "info" as const;
}

function statusBadgeClass(status: StudentTicket["status"]) {
  if (status === "Open") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (status === "In progress") {
    return "border-green-200 bg-green-50 text-green-700";
  }
  if (status === "Accepted") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (status === "Withdrawn") {
    return "border-slate-300 bg-slate-100 text-slate-600";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function formatTicketDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function evidenceDataUrl(ev: TicketEvidence) {
  return `data:${ev.mimeType};base64,${ev.data}`;
}

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

function categoryPreviewImage(category: string) {
  if (category === "Academic") {
    return academicTicketImage.src;
  }
  if (category === "Technical") {
    return technicalTicketImage.src;
  }
  if (category === "Finance") {
    return financeTicketImage.src;
  }
  if (category === "Facility") {
    return facilityTicketImage.src;
  }
  if (category === "Transport") {
    return transportTicketImage.src;
  }
  if (category === "Other") {
    return otherTicketImage.src;
  }
  return null;
}

function ticketMatchesQuery(ticket: StudentTicket, query: string) {
  if (!query) {
    return true;
  }
  const q = query.toLowerCase();
  return (
    ticket.subject.toLowerCase().includes(q) ||
    ticket.description.toLowerCase().includes(q) ||
    ticket.category.toLowerCase().includes(q) ||
    ticket.id.toLowerCase().includes(q)
  );
}

export default function StudentTicketPage() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<StudentTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSubcategory, setEditSubcategory] = useState("");
  const [editPriority, setEditPriority] = useState<StudentTicket["priority"]>("Medium");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editContactWhatsapp, setEditContactWhatsapp] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editExistingEvidence, setEditExistingEvidence] = useState<TicketEvidence[]>([]);
  const [editPendingFiles, setEditPendingFiles] = useState<PendingFile[]>([]);
  const [editEvidenceError, setEditEvidenceError] = useState("");
  const [withdrawingTicketId, setWithdrawingTicketId] = useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawOtherReason, setWithdrawOtherReason] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  const refreshTickets = useCallback(async () => {
    try {
      const items = await loadStudentTickets();
      setTickets(items);
    } catch (error) {
      toast({
        title: "Could not load tickets",
        message:
          error instanceof Error ? error.message : "Check your connection and try again.",
        variant: "error",
      });
    }
  }, [toast]);

  function ticketCanBeChanged(status: StudentTicket["status"]) {
    return status === "Open" || status === "In progress";
  }

  function openEditForm(ticket: StudentTicket) {
    setEditingTicketId(ticket.id);
    setEditSubject(ticket.subject);
    setEditDescription(ticket.description);
    setEditCategory(ticket.category);
    setEditSubcategory(ticket.subcategory ?? "");
    setEditPriority(ticket.priority);
    setEditContactEmail(ticket.contactEmail ?? "");
    setEditContactPhone(ticket.contactPhone ?? "");
    setEditContactWhatsapp(ticket.contactWhatsapp ?? "");
    setEditExistingEvidence(ticket.evidence ?? []);
    setEditPendingFiles([]);
    setEditEvidenceError("");
    setWithdrawingTicketId(null);
  }

  function cancelEditForm() {
    setEditingTicketId(null);
    setEditExistingEvidence([]);
    setEditPendingFiles([]);
    setEditEvidenceError("");
  }

  function removeExistingEvidence(index: number) {
    setEditExistingEvidence((current) => current.filter((_, idx) => idx !== index));
  }

  function removePendingEvidence(key: string) {
    setEditPendingFiles((current) => current.filter((item) => item.key !== key));
    setEditEvidenceError("");
  }

  async function onEditEvidenceSelected(files: FileList | null) {
    if (!files?.length) {
      return;
    }
    setEditEvidenceError("");
    const next = [...editPendingFiles];
    const maxNewFilesAllowed = Math.max(
      0,
      MAX_EVIDENCE_FILES - (editExistingEvidence.length + editPendingFiles.length)
    );
    for (let i = 0; i < files.length; i += 1) {
      const file = files.item(i);
      if (!file) {
        continue;
      }
      if (next.length - editPendingFiles.length >= maxNewFilesAllowed) {
        setEditEvidenceError(`You can attach at most ${MAX_EVIDENCE_FILES} files.`);
        break;
      }
      if (file.size > MAX_FILE_BYTES) {
        setEditEvidenceError(
          `"${file.name}" is too large (max ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB per file).`
        );
        continue;
      }
      const isImg = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isImg && !isPdf) {
        setEditEvidenceError("Only images and PDF files can be attached.");
        continue;
      }
      next.push({ key: generateKey(), file });
    }
    setEditPendingFiles(next);
  }

  async function saveTicketChanges(ticketId: string) {
    const subject = editSubject.trim();
    const description = editDescription.trim();
    const category = editCategory.trim();
    const subcategory = editSubcategory.trim();
    const contactEmail = editContactEmail.trim();
    const contactPhone = editContactPhone.trim();
    const contactWhatsapp = editContactWhatsapp.trim();
    const hasAnyContact = Boolean(contactEmail || contactPhone || contactWhatsapp);
    if (!subject || !description || !category || !subcategory) {
      toast({
        title: "Missing details",
        message: "Subject, description, category and subcategory are required.",
        variant: "error",
      });
      return;
    }
    if (!hasAnyContact) {
      toast({
        title: "Contact required",
        message: "Please provide at least one contact method.",
        variant: "error",
      });
      return;
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      toast({ title: "Invalid email", message: "Please enter a valid email.", variant: "error" });
      return;
    }
    if (contactPhone && !/^\d{10}$/.test(contactPhone)) {
      toast({ title: "Invalid phone", message: "Phone must have 10 digits.", variant: "error" });
      return;
    }
    if (contactWhatsapp && !/^\d{10}$/.test(contactWhatsapp)) {
      toast({
        title: "Invalid WhatsApp",
        message: "WhatsApp number must have 10 digits.",
        variant: "error",
      });
      return;
    }
    setSavingEdit(true);
    try {
      const newEvidence =
        editPendingFiles.length > 0
          ? await Promise.all(editPendingFiles.map((item) => readFileAsEvidence(item.file)))
          : [];
      await updateStudentTicketRemote(ticketId, {
        subject,
        description,
        category,
        subcategory,
        priority: editPriority,
        ...(contactEmail ? { contactEmail } : {}),
        ...(contactPhone ? { contactPhone } : {}),
        ...(contactWhatsapp ? { contactWhatsapp } : {}),
        evidence: [...editExistingEvidence, ...newEvidence],
      });
      await refreshTickets();
      setEditingTicketId(null);
      toast({ title: "Ticket updated", message: "Your ticket details were saved." });
    } catch (error) {
      toast({
        title: "Could not update ticket",
        message: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmWithdraw(ticketId: string) {
    const selected = withdrawReason.trim();
    const reason =
      selected === "Other" ? withdrawOtherReason.trim() : selected;
    if (!reason) {
      toast({
        title: "Reason required",
        message: "Please select a withdrawal reason. If Other, type your reason.",
        variant: "error",
      });
      return;
    }
    setWithdrawing(true);
    try {
      await withdrawStudentTicketRemote(ticketId, reason);
      await refreshTickets();
      setWithdrawingTicketId(null);
      setWithdrawReason("");
      setWithdrawOtherReason("");
      toast({ title: "Ticket withdrawn", message: "Your ticket has been withdrawn." });
    } catch (error) {
      toast({
        title: "Could not withdraw ticket",
        message: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setWithdrawing(false);
    }
  }

  const filteredTickets = useMemo(
    () =>
      tickets.filter((ticket) => {
        if (!ticketMatchesQuery(ticket, query.trim())) {
          return false;
        }
        if (statusFilter !== "all" && ticket.status !== statusFilter) {
          return false;
        }
        if (categoryFilter !== "all" && ticket.category !== categoryFilter) {
          return false;
        }
        if (priorityFilter !== "all" && ticket.priority !== priorityFilter) {
          return false;
        }
        return true;
      }),
    [tickets, query, statusFilter, categoryFilter, priorityFilter]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const items = await loadStudentTickets();
        if (!cancelled) {
          setTickets(items);
        }
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Could not load tickets",
            message:
              error instanceof Error ? error.message : "Check your connection and try again.",
            variant: "error",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  if (loading) {
    return (
      <div className="student-ticket-page space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <Card>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="mt-3 h-24 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="student-ticket-page space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-6 py-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
        <div className="pointer-events-none absolute bottom-0 right-0 h-28 w-44">
          <div className="absolute -bottom-8 right-6 h-32 w-32 rounded-full bg-[#f1efe8]/70" />
          <div className="absolute -bottom-6 -right-5 h-28 w-28 rounded-full bg-[#d9e3f7]/80" />
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-800">My Tickets</h1>
            <p className="mt-1 text-sm text-slate-600">Track maintenance and incident requests</p>
          </div>
          <Button
            className="shrink-0 rounded-2xl border-slate-300 bg-white px-5 text-slate-700 hover:bg-slate-50"
            onClick={() => setModalOpen(true)}
            type="button"
            variant="secondary"
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            New Ticket
          </Button>
        </div>
      </section>

      <CreateTicketModal
        onClose={() => setModalOpen(false)}
        onCreated={refreshTickets}
        open={modalOpen}
      />

      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)] sm:px-6">
        <div className="pointer-events-none absolute bottom-0 right-0 h-24 w-36">
          <div className="absolute -bottom-7 right-5 h-24 w-24 rounded-full bg-[#f1efe8]/65" />
          <div className="absolute -bottom-6 -right-4 h-20 w-20 rounded-full bg-[#d9e3f7]/75" />
        </div>
        <div className="relative space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Title, description, category, or ticket ID"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </label>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="Open">Open</option>
                <option value="In progress">In progress</option>
                <option value="Accepted">Accepted</option>
                <option value="Resolved">Resolved</option>
                <option value="Withdrawn">Withdrawn</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Category
              </label>
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All categories</option>
                {CATEGORY_FILTER_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Priority
              </label>
              <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                <option value="all">All priorities</option>
                {PRIORITY_FILTER_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-5 py-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)] sm:px-6">
        <div className="pointer-events-none absolute bottom-0 right-0 h-28 w-40">
          <div className="absolute -bottom-8 right-6 h-28 w-28 rounded-full bg-[#f1efe8]/70" />
          <div className="absolute -bottom-7 -right-4 h-24 w-24 rounded-full bg-[#d9e3f7]/80" />
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-800">Your Tickets</h2>
          <p className="text-sm text-slate-500">{filteredTickets.length} result(s)</p>
        </div>
        <div className="relative mt-4 space-y-4">
          {filteredTickets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <p className="text-sm text-slate-600">
                No tickets match your filters. Try changing search or filter values.
              </p>
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <div
                className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)] sm:p-5"
                key={ticket.id}
              >
                <div className="pointer-events-none absolute bottom-0 right-0 h-20 w-28">
                  <div className="absolute -bottom-6 right-3 h-20 w-20 rounded-full bg-[#f1efe8]/65" />
                  <div className="absolute -bottom-5 -right-3 h-16 w-16 rounded-full bg-[#d9e3f7]/75" />
                </div>
                <div className="relative z-10 mt-2 grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                  <div className="flex min-w-0 items-center gap-3">
                    {categoryPreviewImage(ticket.category) ? (
                      <img
                        alt={`${ticket.category} ticket`}
                        className="h-14 w-16 shrink-0 rounded-lg border border-border object-cover"
                        src={categoryPreviewImage(ticket.category) ?? ""}
                      />
                    ) : (
                      <div className="flex h-14 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500">
                        <Ticket className="h-4 w-4" aria-hidden />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-slate-800">{ticket.subject}</p>
                      <p className="truncate text-xs text-slate-600">
                        {ticket.category}
                        {ticket.subcategory ? ` / ${ticket.subcategory}` : ""} | Priority: {ticket.priority}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-start md:justify-center">
                    <Badge className={statusBadgeClass(ticket.status)} variant={statusBadgeVariant(ticket.status)}>
                      {ticket.status}
                    </Badge>
                  </div>
                  <div className="flex justify-start md:justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 rounded-2xl border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                      onClick={() =>
                        setExpandedTicketId((current) => (current === ticket.id ? null : ticket.id))
                      }
                    >
                      View Details
                    </Button>
                  </div>
                </div>

                {expandedTicketId === ticket.id ? (
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <p className="text-sm whitespace-pre-wrap text-slate-700">{ticket.description}</p>
                    {ticket.contactEmail || ticket.contactPhone || ticket.contactWhatsapp ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Contact:{" "}
                        {[
                          ticket.contactEmail ? `Email: ${ticket.contactEmail}` : null,
                          ticket.contactPhone ? `Phone: ${ticket.contactPhone}` : null,
                          ticket.contactWhatsapp ? `WhatsApp: ${ticket.contactWhatsapp}` : null,
                        ]
                          .filter(Boolean)
                          .join(" | ")}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">{formatTicketDate(ticket.createdAt)}</p>
                    <p className="mt-1 font-mono text-[11px] text-slate-500">ID {ticket.id}</p>
                    {ticket.withdrawalReason ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Withdrawal reason: {ticket.withdrawalReason}
                      </p>
                    ) : null}
                    {ticket.evidence && ticket.evidence.length > 0 ? (
                      <div className="mt-3 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {ticket.evidence
                            .filter((ev) => ev.mimeType.startsWith("image/"))
                            .map((ev, index) => (
                              <a
                                className="block overflow-hidden rounded-xl border border-slate-200 bg-white hover:border-slate-300"
                                href={evidenceDataUrl(ev)}
                                key={`${ticket.id}-img-${index}`}
                                rel="noreferrer"
                                target="_blank"
                                title={ev.fileName}
                              >
                                <img
                                  alt={ev.fileName}
                                  className="h-28 w-36 object-cover"
                                  src={evidenceDataUrl(ev)}
                                />
                              </a>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {ticket.evidence
                            .filter((ev) => !ev.mimeType.startsWith("image/"))
                            .map((ev, index) => (
                              <a
                                className="inline-flex max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:border-slate-300"
                                href={evidenceDataUrl(ev)}
                                key={`${ticket.id}-file-${index}`}
                                rel="noreferrer"
                                target="_blank"
                              >
                                <FileText className="h-4 w-4 shrink-0 text-text/70" aria-hidden />
                                <span className="min-w-0 truncate">{ev.fileName}</span>
                              </a>
                            ))}
                        </div>
                      </div>
                    ) : null}
                    {ticketCanBeChanged(ticket.status) ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-8 rounded-xl border-slate-300 px-3 text-xs text-slate-700"
                            onClick={() =>
                              editingTicketId === ticket.id ? cancelEditForm() : openEditForm(ticket)
                            }
                          >
                            {editingTicketId === ticket.id ? "Close Edit" : "Update Ticket"}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-8 rounded-xl border-red-300 px-3 text-xs text-red-700 hover:bg-red-50"
                            onClick={() =>
                              setWithdrawingTicketId((current) =>
                                current === ticket.id ? null : ticket.id
                              )
                            }
                          >
                            {withdrawingTicketId === ticket.id ? "Cancel Withdraw" : "Withdraw Ticket"}
                          </Button>
                        </div>

                        {editingTicketId === ticket.id ? (
                          <div className="mt-3 space-y-2">
                            <Input
                              value={editSubject}
                              onChange={(e) => setEditSubject(e.target.value)}
                              placeholder="Subject"
                            />
                            <div className="grid gap-2 sm:grid-cols-3">
                              <Select
                                value={editCategory}
                                onChange={(e) => {
                                  const nextCategory = e.target.value;
                                  setEditCategory(nextCategory);
                                  const defaults = EDIT_SUBCATEGORY_OPTIONS[nextCategory] ?? [];
                                  setEditSubcategory(defaults[0] ?? "");
                                }}
                              >
                                {CATEGORY_FILTER_OPTIONS.map((category) => (
                                  <option key={category} value={category}>
                                    {category}
                                  </option>
                                ))}
                              </Select>
                              <Select
                                value={editSubcategory}
                                onChange={(e) => setEditSubcategory(e.target.value)}
                              >
                                {(EDIT_SUBCATEGORY_OPTIONS[editCategory] ?? []).map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </Select>
                              <Select
                                value={editPriority}
                                onChange={(e) => setEditPriority(e.target.value as StudentTicket["priority"])}
                              >
                                {PRIORITY_FILTER_OPTIONS.map((priority) => (
                                  <option key={priority} value={priority}>
                                    {priority}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <Textarea
                              rows={4}
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              placeholder="Description"
                            />
                            <div className="grid gap-2 sm:grid-cols-3">
                              <Input
                                type="email"
                                value={editContactEmail}
                                onChange={(e) => setEditContactEmail(e.target.value)}
                                placeholder="Email"
                              />
                              <Input
                                inputMode="numeric"
                                value={editContactPhone}
                                onChange={(e) =>
                                  setEditContactPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                                }
                                placeholder="Phone (10 digits)"
                              />
                              <Input
                                inputMode="numeric"
                                value={editContactWhatsapp}
                                onChange={(e) =>
                                  setEditContactWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 10))
                                }
                                placeholder="WhatsApp (10 digits)"
                              />
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Evidence (optional)
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Add or remove evidence. Maximum {MAX_EVIDENCE_FILES} files total.
                              </p>
                              <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-700 hover:border-slate-400">
                                <Paperclip className="h-4 w-4" aria-hidden />
                                Add evidence files
                                <input
                                  className="sr-only"
                                  accept={ACCEPT_EVIDENCE}
                                  type="file"
                                  multiple
                                  disabled={
                                    editExistingEvidence.length + editPendingFiles.length >=
                                    MAX_EVIDENCE_FILES
                                  }
                                  onChange={(e) => void onEditEvidenceSelected(e.target.files)}
                                />
                              </label>
                              {editEvidenceError ? (
                                <p className="mt-2 text-xs text-red-600">{editEvidenceError}</p>
                              ) : null}
                              {editExistingEvidence.length > 0 ? (
                                <div className="mt-2 space-y-1">
                                  {editExistingEvidence.map((ev, index) => (
                                    <div
                                      key={`existing-${index}-${ev.fileName}`}
                                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                    >
                                      <span className="min-w-0 truncate">{ev.fileName}</span>
                                      <button
                                        type="button"
                                        className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                        onClick={() => removeExistingEvidence(index)}
                                        aria-label={`Remove ${ev.fileName}`}
                                      >
                                        <X className="h-3.5 w-3.5" aria-hidden />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              {editPendingFiles.length > 0 ? (
                                <div className="mt-2 space-y-1">
                                  {editPendingFiles.map((item) => (
                                    <div
                                      key={item.key}
                                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                    >
                                      <span className="min-w-0 truncate text-slate-700">
                                        {item.file.name}
                                      </span>
                                      <button
                                        type="button"
                                        className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                        onClick={() => removePendingEvidence(item.key)}
                                        aria-label={`Remove ${item.file.name}`}
                                      >
                                        <X className="h-3.5 w-3.5" aria-hidden />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <Button
                              type="button"
                              className="h-8 rounded-xl bg-[#034aa6] px-3 text-xs text-white hover:bg-[#033d8a]"
                              onClick={() => void saveTicketChanges(ticket.id)}
                              disabled={savingEdit}
                            >
                              {savingEdit ? "Saving..." : "Save Changes"}
                            </Button>
                          </div>
                        ) : null}

                        {withdrawingTicketId === ticket.id ? (
                          <div className="mt-3 space-y-2">
                            <Select
                              value={withdrawReason}
                              onChange={(e) => setWithdrawReason(e.target.value)}
                            >
                              <option value="">Select withdrawal reason</option>
                              {WITHDRAW_REASONS.map((reason) => (
                                <option key={reason} value={reason}>
                                  {reason}
                                </option>
                              ))}
                            </Select>
                            {withdrawReason === "Other" ? (
                              <Input
                                value={withdrawOtherReason}
                                onChange={(e) => setWithdrawOtherReason(e.target.value)}
                                placeholder="Type your reason"
                              />
                            ) : null}
                            <Button
                              type="button"
                              className="h-8 rounded-xl bg-red-600 px-3 text-xs text-white hover:bg-red-700"
                              onClick={() => void confirmWithdraw(ticket.id)}
                              disabled={withdrawing}
                            >
                              {withdrawing ? "Withdrawing..." : "Confirm Withdraw"}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

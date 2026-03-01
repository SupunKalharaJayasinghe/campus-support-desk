"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Copy,
  Edit3,
  Eye,
  Mail,
  Megaphone,
  MoreVertical,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";

type MainTab = "sent" | "inbox";
type AnnouncementStatus = "Draft" | "Scheduled" | "Sent";
type AudienceType = "All" | "Role" | "Faculty" | "Degree Program";
type ChannelType = "In-app" | "Email" | "Both";
type PriorityType = "Normal" | "High";
type InboxType = "System" | "User Report" | "Delivery" | "Other";

interface Announcement {
  id: string;
  title: string;
  message: string;
  audienceType: AudienceType;
  audienceLabel: string;
  channel: ChannelType;
  status: AnnouncementStatus;
  priority: PriorityType;
  deliveryAt: string;
}

interface InboxNotification {
  id: string;
  type: InboxType;
  subject: string;
  preview: string;
  message: string;
  source: string;
  timestamp: string;
  read: boolean;
}

interface ComposeFormState {
  title: string;
  message: string;
  audienceType: AudienceType;
  roleTarget: string;
  facultyTarget: string;
  programTarget: string;
  channel: ChannelType;
  priority: PriorityType;
  deliveryMode: "send_now" | "schedule";
  scheduleDate: string;
  scheduleTime: string;
}

interface ComposeErrors {
  title?: string;
  message?: string;
  audience?: string;
  schedule?: string;
}

const ROLE_OPTIONS = [
  "Student",
  "Lecturer",
  "Lecture Incharge",
  "Lecture Supporter",
  "Lost Item Officer",
  "Administrator",
];

const FACULTY_OPTIONS = [
  "Faculty of Computing",
  "Faculty of Engineering",
  "Faculty of Business",
];

const DEGREE_PROGRAMS_BY_FACULTY: Record<string, string[]> = {
  "Faculty of Computing": ["BSc Computer Science", "BSc Software Engineering"],
  "Faculty of Engineering": ["BEng Mechanical Engineering", "BEng Electrical Engineering"],
  "Faculty of Business": ["BSc Finance", "BBA Business Administration"],
};

const INITIAL_SENT_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "ann-001",
    title: "Semester Orientation Schedule",
    message: "Orientation sessions will begin Monday at 9:00 AM in Main Hall.",
    audienceType: "All",
    audienceLabel: "All Users",
    channel: "Both",
    status: "Sent",
    priority: "Normal",
    deliveryAt: "Mar 02, 2026 • 09:00 AM",
  },
  {
    id: "ann-002",
    title: "Faculty of Computing Lab Maintenance",
    message: "Lab C2 will be unavailable on Friday from 1 PM to 4 PM.",
    audienceType: "Faculty",
    audienceLabel: "Faculty of Computing",
    channel: "In-app",
    status: "Scheduled",
    priority: "High",
    deliveryAt: "Mar 05, 2026 • 01:00 PM",
  },
  {
    id: "ann-003",
    title: "Lecturer Consultation Reminder",
    message: "Please confirm weekly consultation slots before Thursday noon.",
    audienceType: "Role",
    audienceLabel: "Lecturer",
    channel: "Email",
    status: "Draft",
    priority: "Normal",
    deliveryAt: "Not scheduled",
  },
  {
    id: "ann-004",
    title: "New Lost Item Intake Protocol",
    message: "All found items must include location and timestamp in submissions.",
    audienceType: "Role",
    audienceLabel: "Lost Item Officer",
    channel: "Both",
    status: "Sent",
    priority: "High",
    deliveryAt: "Feb 27, 2026 • 10:15 AM",
  },
];

const INITIAL_INBOX_NOTIFICATIONS: InboxNotification[] = [
  {
    id: "inbox-001",
    type: "System",
    subject: "Delivery Report: Orientation Schedule",
    preview: "98.4% of recipients received the message successfully.",
    message:
      "Delivery summary completed. 98.4% delivered in-app and 97.9% delivered by email.",
    source: "Notification Service",
    timestamp: "15 minutes ago",
    read: false,
  },
  {
    id: "inbox-002",
    type: "User Report",
    subject: "Announcement typo reported",
    preview: "Student user reported an incorrect room number in an announcement.",
    message:
      "A student reported that the announced room number for tomorrow's workshop appears incorrect.",
    source: "Student Support",
    timestamp: "1 hour ago",
    read: false,
  },
  {
    id: "inbox-003",
    type: "Delivery",
    subject: "Scheduled message sent",
    preview: "Your scheduled faculty update was delivered to 412 recipients.",
    message:
      "The scheduled faculty notification has been sent successfully to all targeted recipients.",
    source: "Delivery Engine",
    timestamp: "Today, 09:32 AM",
    read: true,
  },
  {
    id: "inbox-004",
    type: "Other",
    subject: "Moderation queue notice",
    preview: "Three content reports are awaiting administrative review.",
    message:
      "Moderation queue count increased to 3 pending reports. Please review and assign.",
    source: "Moderation Center",
    timestamp: "Yesterday, 04:20 PM",
    read: true,
  },
];

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function createDefaultComposeState(): ComposeFormState {
  return {
    title: "",
    message: "",
    audienceType: "All",
    roleTarget: "",
    facultyTarget: "",
    programTarget: "",
    channel: "In-app",
    priority: "Normal",
    deliveryMode: "send_now",
    scheduleDate: "",
    scheduleTime: "",
  };
}

function statusClasses(status: AnnouncementStatus) {
  if (status === "Sent") return "border border-[#034AA6]/25 bg-[#034AA6]/10 text-[#034AA6]";
  if (status === "Scheduled") return "border border-black/15 bg-black/5 text-[#26150F]/82";
  return "border border-black/15 bg-white text-[#26150F]/82";
}

function inboxTypeClasses(type: InboxType) {
  if (type === "System") return "border border-[#034AA6]/25 bg-[#034AA6]/10 text-[#034AA6]";
  if (type === "User Report") return "border border-black/15 bg-black/5 text-[#26150F]/82";
  if (type === "Delivery") return "border border-[#034AA6]/20 bg-[#034AA6]/8 text-[#034AA6]";
  return "border border-black/15 bg-white text-[#26150F]/75";
}

function currentTimestamp() {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminNotificationsPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("sent");
  const [sentAnnouncements, setSentAnnouncements] = useState<Announcement[]>(
    INITIAL_SENT_ANNOUNCEMENTS
  );
  const [inboxNotifications, setInboxNotifications] = useState<InboxNotification[]>(
    INITIAL_INBOX_NOTIFICATIONS
  );
  const [sentSearch, setSentSearch] = useState("");
  const [sentStatusFilter, setSentStatusFilter] = useState("");
  const [sentAudienceFilter, setSentAudienceFilter] = useState("");
  const [inboxSearch, setInboxSearch] = useState("");
  const [inboxTypeFilter, setInboxTypeFilter] = useState("");
  const [inboxReadFilter, setInboxReadFilter] = useState("");
  const [rowMenuAnnouncementId, setRowMenuAnnouncementId] = useState<string | null>(
    null
  );
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<"create" | "edit">("create");
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [composeForm, setComposeForm] = useState<ComposeFormState>(
    createDefaultComposeState
  );
  const [composeErrors, setComposeErrors] = useState<ComposeErrors>({});
  const [previewAnnouncementId, setPreviewAnnouncementId] = useState<string | null>(
    null
  );
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(
    INITIAL_INBOX_NOTIFICATIONS[0]?.id ?? null
  );

  useEffect(() => {
    if (!rowMenuAnnouncementId) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-row-menu]")) setRowMenuAnnouncementId(null);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [rowMenuAnnouncementId]);

  useEffect(() => {
    if (!composeOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setComposeOpen(false);
        setComposeErrors({});
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [composeOpen]);

  const sentCount = sentAnnouncements.length;
  const inboxCount = inboxNotifications.filter((item) => !item.read).length;

  const filteredSentAnnouncements = useMemo(() => {
    const query = sentSearch.trim().toLowerCase();
    return sentAnnouncements.filter((item) => {
      const lookup = `${item.title} ${item.message} ${item.audienceLabel}`.toLowerCase();
      if (query && !lookup.includes(query)) return false;
      if (sentStatusFilter && item.status !== sentStatusFilter) return false;
      if (sentAudienceFilter && item.audienceType !== sentAudienceFilter) return false;
      return true;
    });
  }, [sentAnnouncements, sentSearch, sentStatusFilter, sentAudienceFilter]);

  const filteredInboxNotifications = useMemo(() => {
    const query = inboxSearch.trim().toLowerCase();
    return inboxNotifications.filter((item) => {
      const lookup = `${item.subject} ${item.preview} ${item.message}`.toLowerCase();
      if (query && !lookup.includes(query)) return false;
      if (inboxTypeFilter && item.type !== inboxTypeFilter) return false;
      if (inboxReadFilter === "Unread" && item.read) return false;
      if (inboxReadFilter === "Read" && !item.read) return false;
      return true;
    });
  }, [inboxNotifications, inboxReadFilter, inboxSearch, inboxTypeFilter]);

  const selectedInboxNotification =
    filteredInboxNotifications.find((item) => item.id === selectedInboxId) ??
    filteredInboxNotifications[0] ??
    null;
  const previewAnnouncement =
    sentAnnouncements.find((item) => item.id === previewAnnouncementId) ?? null;

  const availableProgramOptions = useMemo(() => {
    if (composeForm.facultyTarget && DEGREE_PROGRAMS_BY_FACULTY[composeForm.facultyTarget]) {
      return DEGREE_PROGRAMS_BY_FACULTY[composeForm.facultyTarget];
    }
    return Object.values(DEGREE_PROGRAMS_BY_FACULTY).flat();
  }, [composeForm.facultyTarget]);

  const buildAudienceLabel = (form: ComposeFormState) => {
    if (form.audienceType === "All") return "All Users";
    if (form.audienceType === "Role") return form.roleTarget;
    if (form.audienceType === "Faculty") return form.facultyTarget;
    return form.programTarget;
  };

  const validateCompose = () => {
    const nextErrors: ComposeErrors = {};
    if (!composeForm.title.trim()) nextErrors.title = "Title is required.";
    if (!composeForm.message.trim()) nextErrors.message = "Message is required.";
    if (composeForm.audienceType === "Role" && !composeForm.roleTarget) nextErrors.audience = "Select a role target.";
    if (composeForm.audienceType === "Faculty" && !composeForm.facultyTarget) nextErrors.audience = "Select a faculty target.";
    if (composeForm.audienceType === "Degree Program" && !composeForm.programTarget) nextErrors.audience = "Select a degree program target.";
    if (composeForm.deliveryMode === "schedule" && (!composeForm.scheduleDate || !composeForm.scheduleTime)) {
      nextErrors.schedule = "Schedule date and time are required.";
    }
    setComposeErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const openNewCompose = () => {
    setComposeMode("create");
    setEditingAnnouncementId(null);
    setComposeForm(createDefaultComposeState());
    setComposeErrors({});
    setComposeOpen(true);
  };

  const openEditCompose = (announcement: Announcement) => {
    const defaultState = createDefaultComposeState();
    defaultState.title = announcement.title;
    defaultState.message = announcement.message;
    defaultState.audienceType = announcement.audienceType;
    defaultState.channel = announcement.channel;
    defaultState.priority = announcement.priority;
    defaultState.deliveryMode = announcement.status === "Scheduled" ? "schedule" : "send_now";
    if (announcement.audienceType === "Role") defaultState.roleTarget = announcement.audienceLabel;
    if (announcement.audienceType === "Faculty") defaultState.facultyTarget = announcement.audienceLabel;
    if (announcement.audienceType === "Degree Program") defaultState.programTarget = announcement.audienceLabel;
    setComposeMode("edit");
    setEditingAnnouncementId(announcement.id);
    setComposeForm(defaultState);
    setComposeErrors({});
    setComposeOpen(true);
  };

  const upsertAnnouncement = (status: AnnouncementStatus) => {
    const announcement: Announcement = {
      id: composeMode === "edit" && editingAnnouncementId ? editingAnnouncementId : `ann-${Date.now()}`,
      title: composeForm.title.trim() || "Untitled Draft",
      message: composeForm.message.trim(),
      audienceType: composeForm.audienceType,
      audienceLabel: buildAudienceLabel(composeForm),
      channel: composeForm.channel,
      status,
      priority: composeForm.priority,
      deliveryAt:
        status === "Scheduled"
          ? `${composeForm.scheduleDate || "TBD"} • ${composeForm.scheduleTime || "TBD"}`
          : status === "Draft"
            ? "Not scheduled"
            : currentTimestamp(),
    };

    setSentAnnouncements((previous) => {
      if (composeMode === "edit" && editingAnnouncementId) {
        return previous.map((item) => (item.id === editingAnnouncementId ? announcement : item));
      }
      return [announcement, ...previous];
    });
  };

  const handleSaveDraft = () => {
    upsertAnnouncement("Draft");
    setComposeOpen(false);
    setComposeErrors({});
  };

  const handleSendOrSchedule = () => {
    if (!validateCompose()) return;
    const nextStatus: AnnouncementStatus =
      composeForm.deliveryMode === "schedule" ? "Scheduled" : "Sent";
    upsertAnnouncement(nextStatus);
    setComposeOpen(false);
    setComposeErrors({});
  };

  const handleAnnouncementAction = (
    action: "view" | "edit" | "duplicate" | "delete",
    announcement: Announcement
  ) => {
    if (action === "view") setPreviewAnnouncementId(announcement.id);
    if (action === "edit") openEditCompose(announcement);
    if (action === "duplicate") {
      const duplicated: Announcement = {
        ...announcement,
        id: `ann-${Date.now()}`,
        title: `${announcement.title} (Copy)`,
        status: "Draft",
        deliveryAt: "Not scheduled",
      };
      setSentAnnouncements((previous) => [duplicated, ...previous]);
    }
    if (action === "delete" && window.confirm("Delete this announcement?")) {
      setSentAnnouncements((previous) => previous.filter((item) => item.id !== announcement.id));
    }
    setRowMenuAnnouncementId(null);
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#0A0A0A]">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-[#26150F]/75">
            Manage announcements and view received notifications.
          </p>
        </div>
        <Button
          className="gap-2 bg-[#034AA6] text-[#D9D9D9] hover:bg-[#0339A6]"
          onClick={openNewCompose}
          type="button"
        >
          <Plus size={16} />
          New Announcement
        </Button>
      </section>

      <section className="rounded-3xl border border-black/15 bg-white p-4 shadow-[0_8px_24px_rgba(38,21,15,0.08)] sm:p-5">
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-black/12 bg-[#D9D9D9]/30 p-1.5">
          <button
            aria-selected={activeTab === "sent"}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#034AA6]/35",
              activeTab === "sent"
                ? "border-[#034AA6]/40 bg-[#034AA6]/12 text-[#034AA6]"
                : "border-transparent bg-white/80 text-[#26150F]/82 hover:border-black/15 hover:text-[#0339A6]"
            )}
            onClick={() => setActiveTab("sent")}
            role="tab"
            type="button"
          >
            <span>Sent Announcements</span>
            <span className="rounded-full border border-black/12 bg-black/5 px-2 py-0.5 text-xs text-[#26150F]/75">
              {sentCount}
            </span>
          </button>

          <button
            aria-selected={activeTab === "inbox"}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#034AA6]/35",
              activeTab === "inbox"
                ? "border-[#034AA6]/40 bg-[#034AA6]/12 text-[#034AA6]"
                : "border-transparent bg-white/80 text-[#26150F]/82 hover:border-black/15 hover:text-[#0339A6]"
            )}
            onClick={() => setActiveTab("inbox")}
            role="tab"
            type="button"
          >
            <span>Received Notifications</span>
            <span className="rounded-full border border-black/12 bg-black/5 px-2 py-0.5 text-xs text-[#26150F]/75">
              {inboxCount}
            </span>
          </button>
        </div>
      </section>

      {activeTab === "sent" ? (
        <section className="space-y-5">
          <div className="rounded-3xl border border-black/15 bg-white p-5 shadow-[0_8px_24px_rgba(38,21,15,0.08)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="w-full lg:flex-1">
                <Input
                  className="h-11 rounded-xl"
                  onChange={(event) => setSentSearch(event.target.value)}
                  placeholder="Search by title, content, or target…"
                  value={sentSearch}
                />
              </div>
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:ml-auto lg:w-auto lg:flex-nowrap">
                <Select
                  className="h-11 w-full rounded-xl sm:w-40"
                  onChange={(event) => setSentStatusFilter(event.target.value)}
                  value={sentStatusFilter}
                >
                  <option value="">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Sent">Sent</option>
                </Select>
                <Select
                  className="h-11 w-full rounded-xl sm:w-48"
                  onChange={(event) => setSentAudienceFilter(event.target.value)}
                  value={sentAudienceFilter}
                >
                  <option value="">All Audiences</option>
                  <option value="All">All</option>
                  <option value="Faculty">Faculty</option>
                  <option value="Degree Program">Degree Program</option>
                  <option value="Role">Role</option>
                </Select>
                <Button
                  className="h-11 w-full gap-2 rounded-xl bg-[#034AA6] px-4 text-[#D9D9D9] hover:bg-[#0339A6] sm:w-auto"
                  onClick={openNewCompose}
                  type="button"
                >
                  <Plus size={15} />
                  New Announcement
                </Button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-black/15 bg-white shadow-[0_8px_24px_rgba(38,21,15,0.08)]">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-black/10 bg-[#034AA6]/6">
                  <tr className="text-left text-xs uppercase tracking-[0.08em] text-[#26150F]/72">
                    <th className="px-5 py-4 font-medium">Title</th>
                    <th className="px-5 py-4 font-medium">Audience</th>
                    <th className="px-5 py-4 font-medium">Channel</th>
                    <th className="px-5 py-4 font-medium">Status</th>
                    <th className="px-5 py-4 font-medium">Sent/Scheduled Date</th>
                    <th className="px-5 py-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSentAnnouncements.length === 0 ? (
                    <tr>
                      <td className="px-5 py-12" colSpan={6}>
                        <div className="mx-auto flex max-w-md flex-col items-center text-center">
                          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-black/15 bg-[#034AA6]/10 text-[#034AA6]">
                            <Megaphone size={20} />
                          </span>
                          <p className="mt-4 text-base font-semibold text-[#0A0A0A]">
                            No announcements yet
                          </p>
                          <p className="mt-1 text-sm text-[#26150F]/70">
                            Create your first announcement to notify users.
                          </p>
                          <Button
                            className="mt-4 gap-2 bg-[#034AA6] text-[#D9D9D9] hover:bg-[#0339A6]"
                            onClick={openNewCompose}
                            type="button"
                          >
                            <Plus size={15} />
                            Create Announcement
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredSentAnnouncements.map((announcement) => (
                      <tr
                        className="border-b border-black/8 text-sm text-[#26150F] transition-colors hover:bg-[#034AA6]/4"
                        key={announcement.id}
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-[#0A0A0A]">{announcement.title}</p>
                          <p className="mt-0.5 text-xs text-[#26150F]/70">
                            {announcement.message}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-[#26150F]/82">
                          {announcement.audienceLabel}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-full border border-black/12 bg-black/5 px-2.5 py-1 text-xs font-semibold text-[#26150F]/82">
                            {announcement.channel}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                              statusClasses(announcement.status)
                            )}
                          >
                            {announcement.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-[#26150F]/78">
                          {announcement.deliveryAt}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end">
                            <div className="relative" data-row-menu>
                              <button
                                aria-expanded={rowMenuAnnouncementId === announcement.id}
                                aria-label={`Actions for ${announcement.title}`}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/15 text-[#26150F]/80 transition-colors duration-200 hover:border-[#034AA6]/55 hover:text-[#0339A6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#034AA6]/30"
                                onClick={() =>
                                  setRowMenuAnnouncementId((previous) =>
                                    previous === announcement.id ? null : announcement.id
                                  )
                                }
                                type="button"
                              >
                                <MoreVertical size={16} />
                              </button>
                              {rowMenuAnnouncementId === announcement.id ? (
                                <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-2xl border border-black/12 bg-white p-1.5 shadow-[0_10px_28px_rgba(38,21,15,0.12)]">
                                  <button
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[#26150F] transition-colors hover:bg-[#034AA6]/8 hover:text-[#0339A6]"
                                    onClick={() =>
                                      handleAnnouncementAction("view", announcement)
                                    }
                                    type="button"
                                  >
                                    <Eye size={14} />
                                    View
                                  </button>
                                  <button
                                    className={cn(
                                      "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                                      announcement.status === "Sent"
                                        ? "cursor-not-allowed text-[#26150F]/45"
                                        : "text-[#26150F] hover:bg-[#034AA6]/8 hover:text-[#0339A6]"
                                    )}
                                    disabled={announcement.status === "Sent"}
                                    onClick={() =>
                                      handleAnnouncementAction("edit", announcement)
                                    }
                                    type="button"
                                  >
                                    <Edit3 size={14} />
                                    Edit
                                  </button>
                                  <button
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[#26150F] transition-colors hover:bg-[#034AA6]/8 hover:text-[#0339A6]"
                                    onClick={() =>
                                      handleAnnouncementAction("duplicate", announcement)
                                    }
                                    type="button"
                                  >
                                    <Copy size={14} />
                                    Duplicate
                                  </button>
                                  <button
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-700 transition-colors hover:bg-red-50"
                                    onClick={() =>
                                      handleAnnouncementAction("delete", announcement)
                                    }
                                    type="button"
                                  >
                                    <Trash2 size={14} />
                                    Delete
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-5">
          <div className="rounded-3xl border border-black/15 bg-white p-5 shadow-[0_8px_24px_rgba(38,21,15,0.08)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="w-full lg:flex-1">
                <Input
                  className="h-11 rounded-xl"
                  onChange={(event) => setInboxSearch(event.target.value)}
                  placeholder="Search notifications…"
                  value={inboxSearch}
                />
              </div>
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:ml-auto lg:w-auto lg:flex-nowrap">
                <Select
                  className="h-11 w-full rounded-xl sm:w-40"
                  onChange={(event) => setInboxTypeFilter(event.target.value)}
                  value={inboxTypeFilter}
                >
                  <option value="">All Types</option>
                  <option value="System">System</option>
                  <option value="User Report">User Report</option>
                  <option value="Delivery">Delivery</option>
                  <option value="Other">Other</option>
                </Select>
                <Select
                  className="h-11 w-full rounded-xl sm:w-36"
                  onChange={(event) => setInboxReadFilter(event.target.value)}
                  value={inboxReadFilter}
                >
                  <option value="">All Status</option>
                  <option value="Unread">Unread</option>
                  <option value="Read">Read</option>
                </Select>
                <Button
                  className="h-11 w-full rounded-xl border-black/20 bg-white px-4 text-[#26150F] hover:border-[#0339A6]/60 hover:bg-[#034AA6]/5 hover:text-[#0339A6] sm:w-auto"
                  onClick={() =>
                    setInboxNotifications((previous) =>
                      previous.map((item) => ({ ...item, read: true }))
                    )
                  }
                  type="button"
                  variant="secondary"
                >
                  Mark all as read
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-black/15 bg-white p-4 shadow-[0_8px_24px_rgba(38,21,15,0.08)] sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-black/12 bg-white">
                {filteredInboxNotifications.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/15 bg-[#034AA6]/10 text-[#034AA6]">
                      <Bell size={18} />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-[#0A0A0A]">
                      No notifications found
                    </p>
                    <p className="mt-1 text-xs text-[#26150F]/70">
                      Try adjusting your search or filter options.
                    </p>
                  </div>
                ) : (
                  <ul className="max-h-[560px] overflow-auto p-2">
                    {filteredInboxNotifications.map((item) => {
                      const selected = selectedInboxNotification?.id === item.id;
                      return (
                        <li key={item.id}>
                          <button
                            className={cn(
                              "w-full rounded-xl border px-3 py-3 text-left transition-all duration-200",
                              selected
                                ? "border-[#034AA6]/35 bg-[#034AA6]/8"
                                : "border-transparent hover:border-black/12 hover:bg-black/2"
                            )}
                            onClick={() => setSelectedInboxId(item.id)}
                            type="button"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-[#0A0A0A]">
                                {item.subject}
                              </p>
                              {!item.read ? (
                                <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-[#034AA6]" />
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-[#26150F]/70">{item.preview}</p>
                            <p className="mt-2 text-[11px] text-[#26150F]/58">
                              {item.timestamp}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-black/12 bg-white p-4 sm:p-5">
                {selectedInboxNotification ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          inboxTypeClasses(selectedInboxNotification.type)
                        )}
                      >
                        {selectedInboxNotification.type}
                      </span>
                      <span className="text-xs text-[#26150F]/58">
                        {selectedInboxNotification.timestamp}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[#0A0A0A]">
                        {selectedInboxNotification.subject}
                      </h3>
                      <p className="mt-1 text-sm text-[#26150F]/68">
                        Source: {selectedInboxNotification.source}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-black/10 bg-[#D9D9D9]/25 p-4 text-sm text-[#26150F]/85">
                      {selectedInboxNotification.message}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        className="rounded-xl border-black/20 bg-white text-[#26150F] hover:border-[#0339A6]/55 hover:bg-[#034AA6]/5 hover:text-[#0339A6]"
                        onClick={() =>
                          setInboxNotifications((previous) =>
                            previous.map((item) =>
                              item.id === selectedInboxNotification.id
                                ? { ...item, read: !item.read }
                                : item
                            )
                          )
                        }
                        type="button"
                        variant="secondary"
                      >
                        {selectedInboxNotification.read ? "Mark as unread" : "Mark as read"}
                      </Button>
                      <Button
                        className="rounded-xl border-black/20 bg-white text-[#26150F] hover:border-red-500/50 hover:bg-red-50 hover:text-red-700"
                        onClick={() => {
                          if (window.confirm("Delete this notification?")) {
                            setInboxNotifications((previous) =>
                              previous.filter((item) => item.id !== selectedInboxNotification.id)
                            );
                          }
                        }}
                        type="button"
                        variant="secondary"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-52 flex-col items-center justify-center text-center">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/15 bg-[#034AA6]/10 text-[#034AA6]">
                      <Bell size={18} />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-[#0A0A0A]">
                      Select a notification
                    </p>
                    <p className="mt-1 text-xs text-[#26150F]/68">
                      Choose an item from the list to view details.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {composeOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setComposeOpen(false);
              setComposeErrors({});
            }
          }}
          role="presentation"
        >
          <aside
            aria-labelledby="compose-announcement-title"
            aria-modal="true"
            className="absolute right-0 top-0 h-full w-full max-w-xl overflow-auto border-l border-black/12 bg-white p-6 shadow-[0_12px_28px_rgba(38,21,15,0.18)] sm:p-7"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  className="text-xl font-semibold text-[#0A0A0A]"
                  id="compose-announcement-title"
                >
                  {composeMode === "edit" ? "Edit Announcement" : "Compose Announcement"}
                </h2>
                <p className="mt-1 text-sm text-[#26150F]/72">
                  Create targeted updates for users and staff.
                </p>
              </div>
              <button
                aria-label="Close compose announcement panel"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/15 text-[#26150F]/80 transition-colors duration-200 hover:border-[#034AA6]/55 hover:text-[#0339A6]"
                onClick={() => {
                  setComposeOpen(false);
                  setComposeErrors({});
                }}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            <form className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#26150F]" htmlFor="announcement-title">
                  Title
                </label>
                <Input
                  className="mt-1 h-11 rounded-xl"
                  id="announcement-title"
                  onChange={(event) =>
                    setComposeForm((previous) => ({ ...previous, title: event.target.value }))
                  }
                  value={composeForm.title}
                />
                {composeErrors.title ? (
                  <p className="mt-1 text-xs text-[#0339A6]">{composeErrors.title}</p>
                ) : null}
              </div>

              <div>
                <label className="text-sm font-medium text-[#26150F]" htmlFor="announcement-message">
                  Message
                </label>
                <Textarea
                  className="mt-1 rounded-xl"
                  id="announcement-message"
                  onChange={(event) =>
                    setComposeForm((previous) => ({ ...previous, message: event.target.value }))
                  }
                  value={composeForm.message}
                />
                {composeErrors.message ? (
                  <p className="mt-1 text-xs text-[#0339A6]">{composeErrors.message}</p>
                ) : null}
              </div>

              <div className="space-y-4 rounded-2xl border border-black/10 bg-[#D9D9D9]/25 p-4">
                <div>
                  <label className="text-sm font-medium text-[#26150F]" htmlFor="audience-type">
                    Audience Targeting
                  </label>
                  <Select
                    className="mt-1 h-11 rounded-xl"
                    id="audience-type"
                    onChange={(event) =>
                      setComposeForm((previous) => ({
                        ...previous,
                        audienceType: event.target.value as AudienceType,
                        roleTarget: "",
                        facultyTarget: "",
                        programTarget: "",
                      }))
                    }
                    value={composeForm.audienceType}
                  >
                    <option value="All">All</option>
                    <option value="Role">Role</option>
                    <option value="Faculty">Faculty</option>
                    <option value="Degree Program">Degree Program</option>
                  </Select>
                </div>

                {composeForm.audienceType === "Role" ? (
                  <div>
                    <label className="text-sm font-medium text-[#26150F]" htmlFor="target-role">
                      Target Role
                    </label>
                    <Select
                      className="mt-1 h-11 rounded-xl"
                      id="target-role"
                      onChange={(event) =>
                        setComposeForm((previous) => ({
                          ...previous,
                          roleTarget: event.target.value,
                        }))
                      }
                      value={composeForm.roleTarget}
                    >
                      <option value="">Select Role</option>
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}

                {composeForm.audienceType === "Faculty" ? (
                  <div>
                    <label className="text-sm font-medium text-[#26150F]" htmlFor="target-faculty">
                      Target Faculty
                    </label>
                    <Select
                      className="mt-1 h-11 rounded-xl"
                      id="target-faculty"
                      onChange={(event) =>
                        setComposeForm((previous) => ({
                          ...previous,
                          facultyTarget: event.target.value,
                        }))
                      }
                      value={composeForm.facultyTarget}
                    >
                      <option value="">Select Faculty</option>
                      {FACULTY_OPTIONS.map((faculty) => (
                        <option key={faculty} value={faculty}>
                          {faculty}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}

                {composeForm.audienceType === "Degree Program" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-[#26150F]" htmlFor="target-program-faculty">
                        Faculty
                      </label>
                      <Select
                        className="mt-1 h-11 rounded-xl"
                        id="target-program-faculty"
                        onChange={(event) =>
                          setComposeForm((previous) => ({
                            ...previous,
                            facultyTarget: event.target.value,
                            programTarget: "",
                          }))
                        }
                        value={composeForm.facultyTarget}
                      >
                        <option value="">All Faculties</option>
                        {FACULTY_OPTIONS.map((faculty) => (
                          <option key={faculty} value={faculty}>
                            {faculty}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#26150F]" htmlFor="target-program">
                        Degree Program
                      </label>
                      <Select
                        className="mt-1 h-11 rounded-xl"
                        id="target-program"
                        onChange={(event) =>
                          setComposeForm((previous) => ({
                            ...previous,
                            programTarget: event.target.value,
                          }))
                        }
                        value={composeForm.programTarget}
                      >
                        <option value="">Select Program</option>
                        {availableProgramOptions.map((program) => (
                          <option key={program} value={program}>
                            {program}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                ) : null}

                {composeErrors.audience ? (
                  <p className="text-xs text-[#0339A6]">{composeErrors.audience}</p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-[#26150F]" htmlFor="delivery-channel">
                    Channel
                  </label>
                  <Select
                    className="mt-1 h-11 rounded-xl"
                    id="delivery-channel"
                    onChange={(event) =>
                      setComposeForm((previous) => ({
                        ...previous,
                        channel: event.target.value as ChannelType,
                      }))
                    }
                    value={composeForm.channel}
                  >
                    <option value="In-app">In-app</option>
                    <option value="Email">Email</option>
                    <option value="Both">Both</option>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#26150F]" htmlFor="delivery-priority">
                    Priority
                  </label>
                  <Select
                    className="mt-1 h-11 rounded-xl"
                    id="delivery-priority"
                    onChange={(event) =>
                      setComposeForm((previous) => ({
                        ...previous,
                        priority: event.target.value as PriorityType,
                      }))
                    }
                    value={composeForm.priority}
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-black/10 bg-[#D9D9D9]/25 p-4">
                <p className="text-sm font-medium text-[#26150F]">Scheduling</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      composeForm.deliveryMode === "send_now"
                        ? "border-[#034AA6]/40 bg-[#034AA6]/10 text-[#034AA6]"
                        : "border-black/15 bg-white text-[#26150F]/75 hover:border-[#034AA6]/35 hover:text-[#0339A6]"
                    )}
                    onClick={() =>
                      setComposeForm((previous) => ({
                        ...previous,
                        deliveryMode: "send_now",
                      }))
                    }
                    type="button"
                  >
                    Send now
                  </button>
                  <button
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      composeForm.deliveryMode === "schedule"
                        ? "border-[#034AA6]/40 bg-[#034AA6]/10 text-[#034AA6]"
                        : "border-black/15 bg-white text-[#26150F]/75 hover:border-[#034AA6]/35 hover:text-[#0339A6]"
                    )}
                    onClick={() =>
                      setComposeForm((previous) => ({
                        ...previous,
                        deliveryMode: "schedule",
                      }))
                    }
                    type="button"
                  >
                    Schedule
                  </button>
                </div>

                {composeForm.deliveryMode === "schedule" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      className="h-11 rounded-xl"
                      onChange={(event) =>
                        setComposeForm((previous) => ({
                          ...previous,
                          scheduleDate: event.target.value,
                        }))
                      }
                      type="date"
                      value={composeForm.scheduleDate}
                    />
                    <Input
                      className="h-11 rounded-xl"
                      onChange={(event) =>
                        setComposeForm((previous) => ({
                          ...previous,
                          scheduleTime: event.target.value,
                        }))
                      }
                      type="time"
                      value={composeForm.scheduleTime}
                    />
                  </div>
                ) : null}

                {composeErrors.schedule ? (
                  <p className="text-xs text-[#0339A6]">{composeErrors.schedule}</p>
                ) : null}
              </div>
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
              <Button
                className="rounded-xl border-black/20 bg-white text-[#26150F] hover:border-[#0339A6]/55 hover:bg-[#034AA6]/5 hover:text-[#0339A6]"
                onClick={() => {
                  setComposeOpen(false);
                  setComposeErrors({});
                }}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="rounded-xl border-black/20 bg-white text-[#26150F] hover:border-[#0339A6]/55 hover:bg-[#034AA6]/5 hover:text-[#0339A6]"
                  onClick={handleSaveDraft}
                  type="button"
                  variant="secondary"
                >
                  Save Draft
                </Button>
                <Button
                  className="gap-2 rounded-xl bg-[#034AA6] text-[#D9D9D9] hover:bg-[#0339A6]"
                  onClick={handleSendOrSchedule}
                  type="button"
                >
                  {composeForm.deliveryMode === "schedule" ? <Mail size={15} /> : <Send size={15} />}
                  {composeForm.deliveryMode === "schedule" ? "Schedule" : "Send"}
                </Button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {previewAnnouncement ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPreviewAnnouncementId(null);
            }
          }}
          role="presentation"
        >
          <div
            aria-labelledby="announcement-preview-title"
            aria-modal="true"
            className="w-full max-w-xl rounded-2xl border border-black/12 bg-white p-6 shadow-[0_12px_28px_rgba(38,21,15,0.18)]"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  className="text-xl font-semibold text-[#0A0A0A]"
                  id="announcement-preview-title"
                >
                  {previewAnnouncement.title}
                </h3>
                <p className="mt-1 text-sm text-[#26150F]/68">
                  {previewAnnouncement.audienceLabel} • {previewAnnouncement.deliveryAt}
                </p>
              </div>
              <button
                aria-label="Close preview"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/15 text-[#26150F]/80 transition-colors duration-200 hover:border-[#034AA6]/55 hover:text-[#0339A6]"
                onClick={() => setPreviewAnnouncementId(null)}
                type="button"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-5 rounded-2xl border border-black/10 bg-[#D9D9D9]/25 p-4 text-sm text-[#26150F]/82">
              {previewAnnouncement.message}
            </div>
            <div className="mt-5 flex items-center justify-end">
              <Button
                className="rounded-xl border-black/20 bg-white text-[#26150F] hover:border-[#0339A6]/55 hover:bg-[#034AA6]/5 hover:text-[#0339A6]"
                onClick={() => setPreviewAnnouncementId(null)}
                type="button"
                variant="secondary"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import { Megaphone, Send, ShieldCheck, Timer } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useAdminContext } from "@/components/admin/AdminContext";

type DeliveryMode = "send_now" | "schedule";
type Channel = "In-app" | "Email" | "Both";
type Priority = "Normal" | "High";

interface Announcement {
  id: string;
  title: string;
  message: string;
  channel: Channel;
  priority: Priority;
  target: string;
  status: "Draft" | "Scheduled" | "Sent";
  timeLabel: string;
}

const INITIAL_ITEMS: Announcement[] = [
  {
    id: "ann-001",
    title: "LMS Maintenance Window",
    message:
      "The LMS will be unavailable on Friday 9:00 PM – 10:00 PM for routine maintenance.",
    channel: "Both",
    priority: "High",
    target: "All university users",
    status: "Sent",
    timeLabel: "Today • 09:05 AM",
  },
  {
    id: "ann-002",
    title: "Y1S1 Orientation: Weekday Stream",
    message:
      "Orientation details have been published under Resources > Module Content.",
    channel: "In-app",
    priority: "Normal",
    target: "FOC / SE / 2026 June / Y1S1 / Weekday",
    status: "Scheduled",
    timeLabel: "Tomorrow • 08:00 AM",
  },
];

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function statusBadgeVariant(status: Announcement["status"]) {
  if (status === "Sent") return "success";
  if (status === "Scheduled") return "warning";
  return "neutral";
}

export default function AnnouncementsPage() {
  const { scope } = useAdminContext();
  const idCounter = useRef(INITIAL_ITEMS.length);

  const [items, setItems] = useState<Announcement[]>(INITIAL_ITEMS);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<Channel>("Both");
  const [priority, setPriority] = useState<Priority>("Normal");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("send_now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [errors, setErrors] = useState<{
    title?: string;
    message?: string;
    schedule?: string;
  }>({});

  const targetLabel = useMemo(() => {
    return `${scope.faculty} / ${scope.degree} / ${scope.intake} / ${scope.term} / ${scope.stream} / ${scope.subgroup}`;
  }, [scope]);

  const preview = useMemo<Announcement>(() => {
    return {
      id: "preview",
      title: title.trim() || "Announcement title",
      message:
        message.trim() || "Write an announcement message for students and staff.",
      channel,
      priority,
      target: targetLabel,
      status: deliveryMode === "send_now" ? "Sent" : "Scheduled",
      timeLabel:
        deliveryMode === "send_now"
          ? "Just now"
          : `${scheduleDate || "TBD"} • ${scheduleTime || "TBD"}`,
    };
  }, [channel, deliveryMode, message, priority, scheduleDate, scheduleTime, targetLabel, title]);

  const validate = () => {
    const nextErrors: typeof errors = {};
    if (!title.trim()) nextErrors.title = "Title is required.";
    if (!message.trim()) nextErrors.message = "Message is required.";
    if (deliveryMode === "schedule" && (!scheduleDate || !scheduleTime)) {
      nextErrors.schedule = "Schedule date and time are required.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const save = (status: Announcement["status"]) => {
    if (!validate()) return;
    idCounter.current += 1;

    const next: Announcement = {
      id: `ann-${String(idCounter.current).padStart(3, "0")}`,
      title: title.trim(),
      message: message.trim(),
      channel,
      priority,
      target: targetLabel,
      status,
      timeLabel:
        status === "Sent"
          ? "Just now"
          : status === "Draft"
            ? "Not scheduled"
            : `${scheduleDate} • ${scheduleTime}`,
    };

    setItems((previous) => [next, ...previous]);
    setTitle("");
    setMessage("");
    setChannel("Both");
    setPriority("Normal");
    setDeliveryMode("send_now");
    setScheduleDate("");
    setScheduleTime("");
    setErrors({});
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        actions={
          <Badge variant="primary">
            <ShieldCheck className="mr-1" size={14} />
            Admin Broadcast
          </Badge>
        }
        description="Create announcements with scoped targeting and enterprise-safe scheduling."
        title="Announcements"
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <Card title="Create announcement">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-heading" htmlFor="title">
                Title
              </label>
              <Input
                className={cn(
                  errors.title
                    ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200"
                    : ""
                )}
                id="title"
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g., Midterm schedule published"
                value={title}
              />
              {errors.title ? (
                <p className="mt-1 text-xs text-red-700">{errors.title}</p>
              ) : null}
            </div>

            <div>
              <label className="text-sm font-medium text-heading" htmlFor="message">
                Message
              </label>
              <Textarea
                className={cn(
                  errors.message
                    ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200"
                    : ""
                )}
                id="message"
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Write a clear, action-oriented announcement."
                value={message}
              />
              {errors.message ? (
                <p className="mt-1 text-xs text-red-700">{errors.message}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-heading" htmlFor="channel">
                  Channel
                </label>
                <Select
                  id="channel"
                  onChange={(event) => setChannel(event.target.value as Channel)}
                  value={channel}
                >
                  <option value="In-app">In-app</option>
                  <option value="Email">Email</option>
                  <option value="Both">Both</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-heading" htmlFor="priority">
                  Priority
                </label>
                <Select
                  id="priority"
                  onChange={(event) => setPriority(event.target.value as Priority)}
                  value={priority}
                >
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                </Select>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-tint p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                Target
              </p>
              <p className="mt-2 text-sm text-text/80">{targetLabel}</p>
              <p className="mt-1 text-xs text-text/60">
                Target scope is driven by the top context selector.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-heading" htmlFor="delivery">
                  Delivery
                </label>
                <Select
                  id="delivery"
                  onChange={(event) => setDeliveryMode(event.target.value as DeliveryMode)}
                  value={deliveryMode}
                >
                  <option value="send_now">Send now</option>
                  <option value="schedule">Schedule</option>
                </Select>
              </div>
              <div className={cn(deliveryMode === "schedule" ? "" : "opacity-60")}>
                <label className="text-sm font-medium text-heading" htmlFor="scheduleDate">
                  Schedule time
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    disabled={deliveryMode !== "schedule"}
                    id="scheduleDate"
                    onChange={(event) => setScheduleDate(event.target.value)}
                    type="date"
                    value={scheduleDate}
                  />
                  <Input
                    disabled={deliveryMode !== "schedule"}
                    onChange={(event) => setScheduleTime(event.target.value)}
                    type="time"
                    value={scheduleTime}
                  />
                </div>
                {errors.schedule ? (
                  <p className="mt-1 text-xs text-red-700">{errors.schedule}</p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
              <Button onClick={() => save("Draft")} variant="secondary">
                Save draft
              </Button>
              <Button
                className="gap-2"
                onClick={() =>
                  save(deliveryMode === "send_now" ? "Sent" : "Scheduled")
                }
              >
                {deliveryMode === "send_now" ? <Send size={16} /> : <Timer size={16} />}
                {deliveryMode === "send_now" ? "Send" : "Schedule"}
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card title="Preview">
            <div className="rounded-3xl border border-border bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                    {preview.target}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-heading">{preview.title}</p>
                </div>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Megaphone size={18} />
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-text/80">{preview.message}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant={statusBadgeVariant(preview.status)}>{preview.status}</Badge>
                <Badge variant="neutral">{preview.channel}</Badge>
                <Badge variant="neutral">{preview.priority}</Badge>
                <span className="text-xs text-text/60">{preview.timeLabel}</span>
              </div>
            </div>
          </Card>

          <Card title="Recent announcements">
            <div className="space-y-3">
              {items.map((item) => (
                <div className="rounded-3xl border border-border bg-white p-4" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-heading">{item.title}</p>
                      <p className="mt-1 text-xs text-text/60">{item.target}</p>
                    </div>
                    <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm text-text/75">{item.message}</p>
                  <p className="mt-3 text-xs text-text/60">
                    {item.channel} • {item.priority} • {item.timeLabel}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}


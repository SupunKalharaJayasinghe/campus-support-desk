"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: "All" | "Students" | "Lecturers" | "Staff";
  time: string;
}

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([
    {
      id: "a1",
      title: "Platform maintenance window",
      body: "Scheduled maintenance on Saturday from 1:00 AM to 3:00 AM.",
      audience: "All",
      time: "2h ago",
    },
  ]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Announcement["audience"]>("All");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Announcements</h1>
        <p className="text-sm text-slate-500">Create and publish platform-wide announcements.</p>
      </div>
      <Card title="Create announcement">
        <div className="space-y-3">
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" onChange={(e) => setTitle(e.target.value)} placeholder="Title" value={title} />
          <textarea className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" onChange={(e) => setBody(e.target.value)} placeholder="Message body" value={body} />
          <div className="flex items-center gap-2">
            <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" onChange={(e) => setAudience(e.target.value as Announcement["audience"])} value={audience}>
              <option value="All">All</option>
              <option value="Students">Students</option>
              <option value="Lecturers">Lecturers</option>
              <option value="Staff">Staff</option>
            </select>
            <Button
              onClick={() => {
                if (!title.trim() || !body.trim()) {
                  return;
                }
                setItems((prev) => [
                  { id: `a-${Date.now()}`, title: title.trim(), body: body.trim(), audience, time: "Just now" },
                  ...prev,
                ]);
                setTitle("");
                setBody("");
                setAudience("All");
              }}
            >
              Publish
            </Button>
          </div>
        </div>
      </Card>
      <Card title="Recent announcements">
        <div className="space-y-3">
          {items.map((item) => (
            <div className="rounded-xl border border-slate-200 p-4" key={item.id}>
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm text-slate-600">{item.body}</p>
              <p className="mt-2 text-xs text-slate-500">
                Audience: {item.audience} • {item.time}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

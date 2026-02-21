"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  { name: "title", label: "Title", type: "text", required: true },
  {
    name: "content",
    label: "Content",
    type: "textarea",
    required: true
  },
  { name: "isPinned", label: "Is Pinned", type: "toggle" }
];

export function AnnouncementForm() {
  return (
    <FormBuilder fields={fields} submitLabel="Publish Announcement" />
  );
}

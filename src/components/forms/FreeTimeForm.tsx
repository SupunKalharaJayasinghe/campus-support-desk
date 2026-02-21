"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  {
    name: "day",
    label: "Day of Week",
    type: "select",
    options: [
      { label: "Monday", value: "Monday" },
      { label: "Tuesday", value: "Tuesday" },
      { label: "Wednesday", value: "Wednesday" },
      { label: "Thursday", value: "Thursday" },
      { label: "Friday", value: "Friday" }
    ]
  },
  { name: "startTime", label: "Start Time", type: "time" },
  { name: "endTime", label: "End Time", type: "time" },
  { name: "location", label: "Location", type: "text", required: true },
  { name: "notes", label: "Notes", type: "textarea" },
  { name: "isActive", label: "Is Active", type: "toggle" }
];

export function FreeTimeForm() {
  return (
    <FormBuilder fields={fields} submitLabel="Save Slot" />
  );
}

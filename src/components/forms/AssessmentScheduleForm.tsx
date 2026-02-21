"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  { name: "scheduledDate", label: "Scheduled Date", type: "date" },
  { name: "scheduledTime", label: "Scheduled Time", type: "time" },
  { name: "venue", label: "Venue", type: "text" },
  { name: "notes", label: "Notes", type: "textarea" }
];

export function AssessmentScheduleForm() {
  return (
    <FormBuilder fields={fields} submitLabel="Save Schedule" />
  );
}

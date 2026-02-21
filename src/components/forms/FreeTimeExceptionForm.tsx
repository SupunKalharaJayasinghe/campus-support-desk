"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  { name: "date", label: "Date", type: "date" },
  { name: "isAvailable", label: "Is Available", type: "toggle" },
  {
    name: "alternateStart",
    label: "Alternate Start Time",
    type: "time",
    showWhen: { field: "isAvailable", is: true }
  },
  {
    name: "alternateEnd",
    label: "Alternate End Time",
    type: "time",
    showWhen: { field: "isAvailable", is: true }
  },
  {
    name: "alternateLocation",
    label: "Alternate Location",
    type: "text",
    showWhen: { field: "isAvailable", is: true }
  },
  {
    name: "reason",
    label: "Reason",
    type: "textarea"
  }
];

export function FreeTimeExceptionForm() {
  return (
    <FormBuilder fields={fields} submitLabel="Save Exception" />
  );
}

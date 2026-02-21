"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  { name: "year", label: "Year", type: "number", required: true },
  { name: "name", label: "Batch Name", type: "text", required: true },
  {
    name: "degreeProgram",
    label: "Degree Program",
    type: "select",
    options: [
      { label: "BSc Computer Science", value: "CS" },
      { label: "BSc Information Systems", value: "IS" }
    ]
  },
  { name: "isActive", label: "Is Active", type: "toggle" }
];

export function BatchForm() {
  return (
    <FormBuilder fields={fields} submitLabel="Save Batch" defaultValues={{ year: 2024 }} />
  );
}

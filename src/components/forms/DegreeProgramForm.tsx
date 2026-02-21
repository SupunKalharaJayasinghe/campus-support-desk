"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  {
    name: "category",
    label: "Category",
    type: "select",
    required: true,
    options: [
      { label: "Computing", value: "Computing" },
      { label: "Engineering", value: "Engineering" }
    ]
  },
  { name: "name", label: "Name", type: "text", required: true },
  { name: "code", label: "Code", type: "text", required: true },
  {
    name: "duration",
    label: "Duration (years)",
    type: "number",
    required: true,
    min: 1
  },
  {
    name: "description",
    label: "Description",
    type: "textarea"
  },
  { name: "isActive", label: "Is Active", type: "toggle" }
];

export function DegreeProgramForm() {
  return (
    <FormBuilder
      fields={fields}
      submitLabel="Save Program"
      defaultValues={{ duration: 4, isActive: true }}
    />
  );
}

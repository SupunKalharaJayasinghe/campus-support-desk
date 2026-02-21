"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "description", label: "Description", type: "textarea" },
  {
    name: "module",
    label: "Module",
    type: "select",
    options: [
      { label: "Data Structures", value: "CS204" },
      { label: "Database Systems", value: "CS310" }
    ]
  }
];

export function QuestionBankForm() {
  return (
    <FormBuilder fields={fields} submitLabel="Save Question Bank" />
  );
}

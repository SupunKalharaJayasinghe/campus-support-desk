"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  { name: "name", label: "Name", type: "text", required: true },
  {
    name: "code",
    label: "Code",
    type: "text",
    required: true,
    helper: "Use uppercase code"
  },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    placeholder: "Describe the category"
  },
  { name: "isActive", label: "Is Active", type: "toggle" }
];

export function DegreeCategoryForm() {
  return (
    <FormBuilder
      fields={fields}
      submitLabel="Save Category"
      defaultValues={{ isActive: true }}
    />
  );
}

"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  { name: "name", label: "Sub-group Name", type: "text", required: true },
  { name: "code", label: "Sub-group Code", type: "text", required: true },
  { name: "purpose", label: "Purpose", type: "text" },
  {
    name: "parentGroup",
    label: "Parent Group",
    type: "select",
    options: [
      { label: "Group A", value: "A" },
      { label: "Group B", value: "B" }
    ]
  }
];

export function SubGroupForm() {
  return (
    <FormBuilder fields={fields} submitLabel="Save Sub-group" />
  );
}

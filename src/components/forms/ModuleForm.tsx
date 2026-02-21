"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  {
    name: "degreeProgram",
    label: "Degree Program",
    type: "select",
    options: [
      { label: "BSc Computer Science", value: "CS" },
      { label: "BSc Information Systems", value: "IS" }
    ]
  },
  { name: "name", label: "Module Name", type: "text", required: true },
  { name: "code", label: "Module Code", type: "text", required: true },
  {
    name: "credits",
    label: "Credits",
    type: "number",
    required: true,
    min: 1
  },
  {
    name: "year",
    label: "Year",
    type: "select",
    options: [
      { label: "Year 1", value: "1" },
      { label: "Year 2", value: "2" },
      { label: "Year 3", value: "3" },
      { label: "Year 4", value: "4" }
    ]
  },
  {
    name: "semester",
    label: "Semester",
    type: "select",
    options: [
      { label: "Semester 1", value: "1" },
      { label: "Semester 2", value: "2" }
    ]
  },
  {
    name: "description",
    label: "Description",
    type: "textarea"
  },
  { name: "isActive", label: "Is Active", type: "toggle" }
];

export function ModuleForm() {
  return (
    <FormBuilder
      fields={fields}
      submitLabel="Save Module"
      defaultValues={{ credits: 3, isActive: true }}
    />
  );
}

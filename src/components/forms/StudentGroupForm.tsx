"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  { name: "name", label: "Group Name", type: "text", required: true },
  { name: "code", label: "Group Code", type: "text", required: true },
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
    name: "batchYear",
    label: "Batch Year",
    type: "select",
    options: [
      { label: "2024", value: "2024" },
      { label: "2025", value: "2025" }
    ]
  },
  {
    name: "degreeProgram",
    label: "Degree Program",
    type: "select",
    options: [
      { label: "BSc Computer Science", value: "CS" },
      { label: "BSc Information Systems", value: "IS" }
    ]
  }
];

export function StudentGroupForm() {
  return (
    <FormBuilder fields={fields} submitLabel="Save Group" />
  );
}

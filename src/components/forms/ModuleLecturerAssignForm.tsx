"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  {
    name: "lecturer",
    label: "Lecturer",
    type: "select",
    options: [
      { label: "Marcus Lee", value: "marcus" },
      { label: "Amelia Tran", value: "amelia" }
    ]
  },
  {
    name: "role",
    label: "Role",
    type: "select",
    options: [
      { label: "Coordinator", value: "Coordinator" },
      { label: "Lecturer", value: "Lecturer" },
      { label: "Lab Instructor", value: "Lab Instructor" },
      { label: "Tutor", value: "Tutor" }
    ]
  },
  {
    name: "canGrade",
    label: "Can Grade",
    type: "toggle"
  }
];

export function ModuleLecturerAssignForm() {
  return (
    <FormBuilder fields={fields} submitLabel="Assign Lecturer" />
  );
}

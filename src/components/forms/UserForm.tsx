"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  {
    name: "profileImage",
    label: "Profile Image",
    type: "file",
    helper: "Upload a profile photo"
  },
  { name: "firstName", label: "First Name", type: "text", required: true },
  { name: "lastName", label: "Last Name", type: "text", required: true },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "phone", label: "Phone", type: "text" },
  {
    name: "role",
    label: "Role",
    type: "select",
    required: true,
    options: [
      { label: "Super Admin", value: "Super Admin" },
      { label: "Department Admin", value: "Department Admin" },
      { label: "Lecturer", value: "Lecturer" },
      { label: "Student", value: "Student" },
      { label: "Lost Item Staff", value: "Lost Item Staff" }
    ]
  },
  {
    name: "degreeProgram",
    label: "Degree Program",
    type: "select",
    options: [
      { label: "BSc Computer Science", value: "CS" },
      { label: "BSc Information Systems", value: "IS" }
    ],
    showWhen: { field: "role", is: "Student" }
  },
  {
    name: "batch",
    label: "Batch",
    type: "select",
    options: [
      { label: "2024 Intake", value: "2024" },
      { label: "2025 Intake", value: "2025" }
    ],
    showWhen: { field: "role", is: "Student" }
  },
  {
    name: "group",
    label: "Group",
    type: "select",
    options: [
      { label: "Group A", value: "A" },
      { label: "Group B", value: "B" }
    ],
    showWhen: { field: "role", is: "Student" }
  },
  {
    name: "subGroup",
    label: "Sub-group",
    type: "select",
    options: [
      { label: "Sub-group 1", value: "1" },
      { label: "Sub-group 2", value: "2" }
    ],
    showWhen: { field: "role", is: "Student" }
  },
  {
    name: "employeeId",
    label: "Employee ID",
    type: "text",
    showWhen: { field: "role", is: "Lecturer" }
  },
  {
    name: "specialization",
    label: "Specialization",
    type: "text",
    showWhen: { field: "role", is: "Lecturer" }
  },
  {
    name: "assignedPrograms",
    label: "Assigned Degree Programs",
    type: "multiselect",
    options: [
      { label: "BSc Computer Science", value: "CS" },
      { label: "BSc Information Systems", value: "IS" }
    ],
    showWhen: { field: "role", is: "Department Admin" }
  },
  {
    name: "password",
    label: "Password",
    type: "password",
    required: true
  },
  {
    name: "confirmPassword",
    label: "Confirm Password",
    type: "password",
    required: true
  },
  {
    name: "isActive",
    label: "Is Active",
    type: "toggle"
  }
];

export function UserForm() {
  return (
    <FormBuilder
      fields={fields}
      submitLabel="Save User"
      defaultValues={{ role: "Student", isActive: true }}
    />
  );
}

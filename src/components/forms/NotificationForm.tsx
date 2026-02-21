"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  { name: "title", label: "Title", type: "text", required: true },
  {
    name: "message",
    label: "Message",
    type: "textarea",
    required: true
  },
  {
    name: "type",
    label: "Type",
    type: "select",
    options: [
      { label: "General", value: "General" },
      { label: "Academic", value: "Academic" },
      { label: "Exam", value: "Exam" },
      { label: "Assignment", value: "Assignment" },
      { label: "Quiz", value: "Quiz" },
      { label: "Urgent", value: "Urgent" }
    ]
  },
  {
    name: "targetType",
    label: "Target Type",
    type: "select",
    options: [
      { label: "All Users", value: "All" },
      { label: "All Students", value: "Students" },
      { label: "All Lecturers", value: "Lecturers" },
      { label: "Degree Program", value: "Program" },
      { label: "Year", value: "Year" },
      { label: "Semester", value: "Semester" },
      { label: "Group", value: "Group" },
      { label: "Module Students", value: "Module" },
      { label: "Individual", value: "Individual" }
    ]
  },
  {
    name: "targetProgram",
    label: "Degree Program",
    type: "select",
    options: [
      { label: "BSc Computer Science", value: "CS" },
      { label: "BSc Information Systems", value: "IS" }
    ],
    showWhen: { field: "targetType", is: "Program" }
  },
  {
    name: "targetYear",
    label: "Year",
    type: "select",
    options: [
      { label: "Year 1", value: "1" },
      { label: "Year 2", value: "2" },
      { label: "Year 3", value: "3" },
      { label: "Year 4", value: "4" }
    ],
    showWhen: { field: "targetType", is: "Year" }
  },
  {
    name: "targetSemester",
    label: "Semester",
    type: "select",
    options: [
      { label: "Semester 1", value: "1" },
      { label: "Semester 2", value: "2" }
    ],
    showWhen: { field: "targetType", is: "Semester" }
  },
  {
    name: "targetGroup",
    label: "Group",
    type: "select",
    options: [
      { label: "Group A", value: "A" },
      { label: "Group B", value: "B" }
    ],
    showWhen: { field: "targetType", is: "Group" }
  },
  {
    name: "targetModule",
    label: "Module",
    type: "select",
    options: [
      { label: "Data Structures", value: "CS204" },
      { label: "Database Systems", value: "CS310" }
    ],
    showWhen: { field: "targetType", is: "Module" }
  },
  {
    name: "targetUser",
    label: "Individual User",
    type: "text",
    showWhen: { field: "targetType", is: "Individual" }
  },
  {
    name: "link",
    label: "Link",
    type: "text",
    helper: "Optional URL for more details"
  }
];

export function NotificationForm() {
  return (
    <FormBuilder fields={fields} submitLabel="Send Notification" />
  );
}

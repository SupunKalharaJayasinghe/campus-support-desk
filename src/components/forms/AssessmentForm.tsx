"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  { name: "title", label: "Title", type: "text", required: true },
  {
    name: "type",
    label: "Type",
    type: "select",
    required: true,
    options: [
      { label: "Lab Test", value: "Lab Test" },
      { label: "Assignment", value: "Assignment" },
      { label: "Mid Exam", value: "Mid Exam" },
      { label: "Final Exam", value: "Final Exam" }
    ]
  },
  {
    name: "format",
    label: "Format",
    type: "select",
    options: [
      { label: "MCQ Quiz", value: "MCQ Quiz" },
      { label: "Essay", value: "Essay" },
      { label: "File Upload", value: "File Upload" },
      { label: "Handwritten", value: "Handwritten" }
    ]
  },
  {
    name: "description",
    label: "Description",
    type: "textarea"
  },
  {
    name: "maxMarks",
    label: "Max Marks",
    type: "number",
    required: true,
    min: 1
  },
  {
    name: "passingMarks",
    label: "Passing Marks",
    type: "number",
    min: 0
  },
  {
    name: "duration",
    label: "Duration (minutes)",
    type: "number",
    min: 10
  },
  {
    name: "dueDate",
    label: "Due Date",
    type: "date"
  },
  {
    name: "instructions",
    label: "Instructions",
    type: "textarea"
  },
  {
    name: "allowLate",
    label: "Allow Late Submission",
    type: "toggle"
  },
  {
    name: "allowResubmission",
    label: "Allow Resubmission",
    type: "toggle"
  },
  {
    name: "maxFileUploads",
    label: "Max File Uploads",
    type: "number",
    min: 1
  },
  {
    name: "negativeMarking",
    label: "Negative Marking",
    type: "toggle"
  },
  {
    name: "negativeMarkValue",
    label: "Negative Mark Value",
    type: "number",
    showWhen: { field: "negativeMarking", is: true }
  },
  {
    name: "attachments",
    label: "Attachments",
    type: "file",
    helper: "Upload supporting files",
    multiple: true
  }
];

export function AssessmentForm() {
  return (
    <FormBuilder
      fields={fields}
      submitLabel="Save Assessment"
      defaultValues={{ allowLate: false, allowResubmission: false }}
    />
  );
}

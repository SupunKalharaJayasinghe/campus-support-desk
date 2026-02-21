"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  { name: "questionNumber", label: "Question Number", type: "text" },
  {
    name: "questionType",
    label: "Question Type",
    type: "select",
    options: [
      { label: "MCQ Single", value: "MCQ Single" },
      { label: "MCQ Multiple", value: "MCQ Multiple" },
      { label: "True/False", value: "True/False" },
      { label: "Short Answer", value: "Short Answer" },
      { label: "Essay", value: "Essay" },
      { label: "Fill in Blank", value: "Fill in Blank" },
      { label: "File Upload", value: "File Upload" }
    ]
  },
  {
    name: "questionText",
    label: "Question Text",
    type: "textarea",
    required: true
  },
  {
    name: "marks",
    label: "Marks",
    type: "number",
    required: true,
    min: 0
  },
  {
    name: "negativeMarks",
    label: "Negative Marks",
    type: "number",
    min: 0
  },
  {
    name: "optionA",
    label: "Option A",
    type: "text",
    showWhen: { field: "questionType", is: "MCQ Single" }
  },
  {
    name: "optionB",
    label: "Option B",
    type: "text",
    showWhen: { field: "questionType", is: "MCQ Single" }
  },
  {
    name: "optionC",
    label: "Option C",
    type: "text",
    showWhen: { field: "questionType", is: "MCQ Single" }
  },
  {
    name: "optionD",
    label: "Option D",
    type: "text",
    showWhen: { field: "questionType", is: "MCQ Single" }
  },
  {
    name: "correctAnswer",
    label: "Correct Answer",
    type: "text",
    showWhen: { field: "questionType", is: "MCQ Single" }
  },
  {
    name: "trueFalseAnswer",
    label: "Correct Answer",
    type: "select",
    options: [
      { label: "True", value: "True" },
      { label: "False", value: "False" }
    ],
    showWhen: { field: "questionType", is: "True/False" }
  },
  {
    name: "blankAnswers",
    label: "Blanks",
    type: "textarea",
    helper: "List correct blank values",
    showWhen: { field: "questionType", is: "Fill in Blank" }
  },
  {
    name: "allowedFileTypes",
    label: "Allowed File Types",
    type: "text",
    helper: "Example: .pdf, .docx",
    showWhen: { field: "questionType", is: "File Upload" }
  },
  {
    name: "maxFileSize",
    label: "Max File Size (MB)",
    type: "number",
    showWhen: { field: "questionType", is: "File Upload" }
  }
];

export function QuestionForm() {
  return (
    <FormBuilder
      fields={fields}
      submitLabel="Save Question"
      defaultValues={{ questionType: "MCQ Single" }}
    />
  );
}

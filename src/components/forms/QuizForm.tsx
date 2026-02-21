"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "description", label: "Description", type: "textarea" },
  {
    name: "duration",
    label: "Duration (minutes)",
    type: "number",
    required: true,
    min: 1
  },
  {
    name: "totalMarks",
    label: "Total Marks",
    type: "number",
    min: 0
  },
  {
    name: "passingMarks",
    label: "Passing Marks",
    type: "number",
    required: true,
    min: 0
  },
  { name: "startDateTime", label: "Start Date & Time", type: "datetime" },
  { name: "endDateTime", label: "End Date & Time", type: "datetime" },
  { name: "randomizeQuestions", label: "Randomize Questions", type: "toggle" },
  { name: "randomizeOptions", label: "Randomize Options", type: "toggle" },
  { name: "negativeMarking", label: "Negative Marking", type: "toggle" },
  {
    name: "negativeMarkValue",
    label: "Negative Mark Value",
    type: "number",
    showWhen: { field: "negativeMarking", is: true }
  },
  { name: "selectFromBank", label: "Select from Question Bank", type: "toggle" },
  {
    name: "questionBank",
    label: "Question Bank",
    type: "select",
    options: [
      { label: "Week 1 Bank", value: "week1" },
      { label: "Week 2 Bank", value: "week2" }
    ],
    showWhen: { field: "selectFromBank", is: true }
  },
  {
    name: "questionCount",
    label: "Number of Questions",
    type: "number",
    showWhen: { field: "selectFromBank", is: true }
  }
];

export function QuizForm() {
  return (
    <FormBuilder fields={fields} submitLabel="Save Quiz" />
  );
}

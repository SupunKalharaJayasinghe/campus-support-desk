"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  {
    name: "labTestWeight",
    label: "Lab Test Weight (%)",
    type: "number",
    min: 0,
    max: 100
  },
  {
    name: "assignmentWeight",
    label: "Assignment Weight (%)",
    type: "number",
    min: 0,
    max: 100
  },
  {
    name: "midExamWeight",
    label: "Mid Exam Weight (%)",
    type: "number",
    min: 0,
    max: 100
  },
  {
    name: "finalExamWeight",
    label: "Final Exam Weight (%)",
    type: "number",
    min: 0,
    max: 100
  }
];

export function ModuleWeightageForm() {
  return (
    <FormBuilder
      fields={fields}
      submitLabel="Save Weightage"
      validate={(values) => {
        const total =
          Number(values.labTestWeight || 0) +
          Number(values.assignmentWeight || 0) +
          Number(values.midExamWeight || 0) +
          Number(values.finalExamWeight || 0);
        return total === 100 ? null : "Total weightage must equal 100%.";
      }}
    />
  );
}

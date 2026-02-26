"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  {
    name: "category",
    label: "Category",
    type: "select",
    required: true,
    options: [
      { label: "Computing", value: "Computing" },
      { label: "Engineering", value: "Engineering" }
    ]
  },
  { name: "name", label: "Name", type: "text", required: true },
  { name: "code", label: "Code", type: "text", required: true },
  {
    name: "duration",
    label: "Duration (years)",
    type: "number",
    required: true,
    min: 1
  },
  {
    name: "description",
    label: "Description",
    type: "textarea"
  },
  { name: "isActive", label: "Is Active", type: "toggle" }
];

export type DegreeProgramFormValues = {
  category: string;
  name: string;
  code: string;
  duration: number;
  description?: string;
  isActive?: boolean;
};

export type DegreeProgramFormProps = {
  defaultValues?: Partial<DegreeProgramFormValues>;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit?: (values: DegreeProgramFormValues) => Promise<void> | void;
  onCancel?: () => void;
};

export function DegreeProgramForm({
  defaultValues,
  submitLabel = "Save Program",
  cancelLabel = "Cancel",
  onSubmit,
  onCancel
}: DegreeProgramFormProps) {
  return (
    <FormBuilder<DegreeProgramFormValues>
      fields={fields}
      submitLabel={submitLabel}
      cancelLabel={cancelLabel}
      defaultValues={{ duration: 4, isActive: true, ...defaultValues }}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
}

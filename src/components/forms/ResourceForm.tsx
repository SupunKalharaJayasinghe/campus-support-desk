"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "description", label: "Description", type: "textarea" },
  {
    name: "resourceType",
    label: "Resource Type",
    type: "select",
    options: [
      { label: "Document", value: "Document" },
      { label: "Video", value: "Video" },
      { label: "Link", value: "Link" },
      { label: "Other", value: "Other" }
    ]
  },
  {
    name: "resourceFile",
    label: "Upload File",
    type: "file",
    showWhen: { field: "resourceType", is: "Document" }
  },
  {
    name: "resourceVideo",
    label: "Upload Video",
    type: "file",
    showWhen: { field: "resourceType", is: "Video" }
  },
  {
    name: "externalLink",
    label: "External Link",
    type: "text",
    showWhen: { field: "resourceType", is: "Link" }
  }
];

export function ResourceForm() {
  return (
    <FormBuilder fields={fields} submitLabel="Save Resource" />
  );
}

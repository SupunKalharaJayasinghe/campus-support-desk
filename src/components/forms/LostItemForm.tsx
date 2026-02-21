"use client";

import { FormBuilder, FormField } from "@/components/forms/FormBuilder";

const fields: FormField[] = [
  { name: "title", label: "Title", type: "text", required: true },
  {
    name: "itemType",
    label: "Item Type",
    type: "select",
    options: [
      { label: "Lost", value: "Lost" },
      { label: "Found", value: "Found" }
    ]
  },
  {
    name: "category",
    label: "Category",
    type: "select",
    options: [
      { label: "Electronics", value: "Electronics" },
      { label: "Books", value: "Books" },
      { label: "ID Cards", value: "ID Cards" },
      { label: "Clothing", value: "Clothing" },
      { label: "Bags", value: "Bags" },
      { label: "Keys", value: "Keys" },
      { label: "Other", value: "Other" }
    ]
  },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    required: true
  },
  {
    name: "location",
    label: "Location",
    type: "text",
    required: true
  },
  { name: "date", label: "Date", type: "date" },
  {
    name: "images",
    label: "Images",
    type: "file",
    helper: "Upload up to 5 images",
    multiple: true
  },
  { name: "contactName", label: "Contact Name", type: "text", required: true },
  { name: "contactPhone", label: "Contact Phone", type: "text" },
  { name: "contactEmail", label: "Contact Email", type: "email" }
];

export function LostItemForm() {
  return (
    <FormBuilder fields={fields} submitLabel="Submit Report" />
  );
}

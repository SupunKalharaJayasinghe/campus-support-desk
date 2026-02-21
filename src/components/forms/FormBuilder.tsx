"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import { Select, SelectOption } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { DatePicker } from "@/components/ui/DatePicker";
import { TimePicker } from "@/components/ui/TimePicker";
import { FileUpload } from "@/components/ui/FileUpload";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { mockDelay } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";

export type FormField = {
  name: string;
  label: string;
  type:
    | "text"
    | "email"
    | "password"
    | "number"
    | "select"
    | "multiselect"
    | "textarea"
    | "date"
    | "time"
    | "datetime"
    | "file"
    | "toggle";
  placeholder?: string;
  helper?: string;
  options?: SelectOption[];
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  showWhen?: {
    field: string;
    is: string | boolean;
  };
  multiple?: boolean;
};

export function FormBuilder<T extends Record<string, unknown>>({
  fields,
  defaultValues,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  onSubmit,
  onCancel,
  validate
}: {
  fields: FormField[];
  defaultValues?: Partial<T>;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit?: (values: T) => Promise<void> | void;
  onCancel?: () => void;
  validate?: (values: T) => string | null;
}) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<T>({ defaultValues: defaultValues as T });
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const values = watch();

  const visibleFields = useMemo(
    () =>
      fields.filter((field) => {
        if (!field.showWhen) return true;
        return values?.[field.showWhen.field] === field.showWhen.is;
      }),
    [fields, values]
  );

  const submitHandler = handleSubmit(async (data) => {
    setFormError(null);
    setSuccessMessage(null);
    const validationMessage = validate?.(data);
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }
    if (onSubmit) {
      await onSubmit(data);
    } else {
      await mockDelay(600);
    }
    toast.success("Changes saved successfully.");
    setSuccessMessage("Saved successfully.");
  });

  return (
    <form className="space-y-6" onSubmit={submitHandler}>
      {formError && (
        <Alert variant="error" title="Something went wrong" description={formError} />
      )}
      {successMessage && (
        <Alert variant="success" title="Success" description={successMessage} />
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {visibleFields.map((field) => {
          const error = (errors as Record<string, { message?: string }>)[field.name]
            ?.message as string | undefined;

          if (field.type === "textarea") {
            return (
              <Textarea
                key={field.name}
                label={field.label}
                placeholder={field.placeholder}
                helper={field.helper}
                error={error}
                {...register(field.name as keyof T, {
                  required: field.required ? "This field is required" : false
                })}
                className="md:col-span-2"
              />
            );
          }

          if (field.type === "select" || field.type === "multiselect") {
            return (
              <Select
                key={field.name}
                label={field.label}
                placeholder={field.placeholder}
                helper={field.helper}
                error={error}
                multiple={field.type === "multiselect"}
                options={field.options ?? []}
                {...register(field.name as keyof T, {
                  required: field.required ? "This field is required" : false
                })}
              />
            );
          }

          if (field.type === "date") {
            return (
              <Controller
                key={field.name}
                control={control}
                name={field.name as keyof T}
                render={({ field: controllerField }) => (
                  <DatePicker
                    label={field.label}
                    value={(controllerField.value as string) ?? ""}
                    onChange={controllerField.onChange}
                    error={error}
                    helper={field.helper}
                  />
                )}
              />
            );
          }

          if (field.type === "time") {
            return (
              <Controller
                key={field.name}
                control={control}
                name={field.name as keyof T}
                render={({ field: controllerField }) => (
                  <TimePicker
                    label={field.label}
                    value={(controllerField.value as string) ?? ""}
                    onChange={controllerField.onChange}
                    error={error}
                    helper={field.helper}
                  />
                )}
              />
            );
          }

          if (field.type === "file") {
            return (
              <Controller
                key={field.name}
                control={control}
                name={field.name as keyof T}
                render={({ field: controllerField }) => (
                  <FileUpload
                    label={field.label}
                    value={(controllerField.value as File[]) ?? []}
                    onChange={controllerField.onChange}
                    helper={field.helper}
                    error={error}
                    multiple={field.multiple}
                  />
                )}
              />
            );
          }

          if (field.type === "toggle") {
            return (
              <Controller
                key={field.name}
                control={control}
                name={field.name as keyof T}
                render={({ field: controllerField }) => (
                  <Toggle
                    label={field.label}
                    checked={Boolean(controllerField.value)}
                    onChange={controllerField.onChange}
                  />
                )}
              />
            );
          }

          return (
            <Input
              key={field.name}
              label={field.label}
              type={field.type === "datetime" ? "datetime-local" : field.type}
              placeholder={field.placeholder}
              helper={field.helper}
              error={error}
              {...register(field.name as keyof T, {
                required: field.required ? "This field is required" : false,
                min: field.min,
                max: field.max
              })}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

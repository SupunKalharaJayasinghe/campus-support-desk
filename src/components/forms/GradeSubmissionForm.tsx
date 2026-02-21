"use client";

import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/hooks/useToast";
import { mockDelay } from "@/lib/utils";
import { useState } from "react";

type GradeValues = {
  marks: number;
  feedback: string;
};

export function GradeSubmissionForm({
  studentName = "Ariana Silva",
  studentId = "ST-2041"
}: {
  studentName?: string;
  studentId?: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<GradeValues>({
    defaultValues: { marks: 0, feedback: "" }
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const toast = useToast();

  const onSubmit = handleSubmit(async () => {
    setErrorMessage(null);
    await mockDelay(500);
    toast.success("Grades submitted.");
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {errorMessage && (
        <Alert variant="error" title="Unable to save" description={errorMessage} />
      )}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <p className="font-medium text-slate-700">{studentName}</p>
        <p className="text-xs text-slate-500">Student ID: {studentId}</p>
      </div>
      <Input
        label="Marks Obtained"
        type="number"
        error={errors.marks?.message}
        {...register("marks", { required: "Marks are required", min: 0 })}
      />
      <Textarea
        label="Feedback"
        error={errors.feedback?.message}
        {...register("feedback")}
      />
      <Button type="submit" loading={isSubmitting}>
        Save Grade
      </Button>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useState } from "react";

type ForgotValues = {
  email: string;
};

export default function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ForgotValues>();
  const [success, setSuccess] = useState(false);

  const onSubmit = handleSubmit(async () => {
    setSuccess(true);
  });

  return (
    <div className="w-full max-w-lg">
      <Card title="Forgot Password" description="Enter your email to reset your password.">
        <form className="space-y-4" onSubmit={onSubmit}>
          {success && (
            <Alert
              variant="success"
              title="Email sent"
              description="Check your inbox for reset instructions."
            />
          )}
          <Input
            label="Email"
            type="email"
            placeholder="name@campus.edu"
            error={errors.email?.message}
            {...register("email", { required: "Email is required" })}
          />
          <Button type="submit" loading={isSubmitting} className="w-full">
            Send reset link
          </Button>
          <Link href="/login" className="block text-center text-sm text-indigo-600">
            Back to login
          </Link>
        </form>
      </Card>
    </div>
  );
}

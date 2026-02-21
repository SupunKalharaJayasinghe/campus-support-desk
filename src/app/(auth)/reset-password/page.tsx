"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useState } from "react";

type ResetValues = {
  password: string;
  confirmPassword: string;
};

export default function ResetPasswordPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ResetValues>();
  const [success, setSuccess] = useState(false);

  const onSubmit = handleSubmit(() => {
    setSuccess(true);
  });

  return (
    <div className="w-full max-w-lg">
      <Card title="Reset Password" description="Set a new secure password for your account.">
        <form className="space-y-4" onSubmit={onSubmit}>
          {success && (
            <Alert
              variant="success"
              title="Password updated"
              description="You can now sign in with your new password."
            />
          )}
          <Input
            label="New Password"
            type="password"
            placeholder="At least 6 characters"
            error={errors.password?.message}
            {...register("password", { required: "Password is required" })}
          />
          <Input
            label="Confirm Password"
            type="password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword", { required: "Confirm your password" })}
          />
          <ul className="text-xs text-slate-500">
            <li>Minimum 6 characters</li>
            <li>Include at least one number or symbol</li>
          </ul>
          <Button type="submit" loading={isSubmitting} className="w-full">
            Reset password
          </Button>
          <Link href="/login" className="block text-center text-sm text-indigo-600">
            Back to login
          </Link>
        </form>
      </Card>
    </div>
  );
}

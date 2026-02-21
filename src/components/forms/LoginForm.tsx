"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useState } from "react";
import { useToast } from "@/hooks/useToast";
import { mockDelay } from "@/lib/utils";

type LoginValues = {
  email: string;
  password: string;
  remember: boolean;
};

export function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginValues>({
    defaultValues: {
      email: "",
      password: "",
      remember: true
    }
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const toast = useToast();

  const onSubmit = handleSubmit(async () => {
    setErrorMessage(null);
    await mockDelay(600);
    toast.success("Welcome back!", "Login");
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {errorMessage && (
        <Alert variant="error" title="Login failed" description={errorMessage} />
      )}
      <Input
        label="Email"
        type="email"
        placeholder="name@campus.edu"
        error={errors.email?.message}
        {...register("email", {
          required: "Email is required",
          pattern: {
            value: /\S+@\S+\.\S+/,
            message: "Enter a valid email"
          }
        })}
      />
      <Input
        label="Password"
        type="password"
        placeholder="Enter your password"
        error={errors.password?.message}
        {...register("password", {
          required: "Password is required",
          minLength: {
            value: 6,
            message: "Minimum 6 characters"
          }
        })}
      />
      <div className="flex items-center justify-between text-sm text-slate-600">
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register("remember")} />
          Remember me
        </label>
        <Link href="/forgot-password" className="text-indigo-600 hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" loading={isSubmitting} className="w-full">
        Sign In
      </Button>
    </form>
  );
}

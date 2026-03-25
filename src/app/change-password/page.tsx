"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import {
  HOME_BY_ROLE,
  authHeaders,
  clearDemoSession,
  readStoredRole,
  readStoredUser,
  updateStoredUser,
} from "@/models/rbac";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const role = useMemo(() => readStoredRole(), []);
  const user = useMemo(() => readStoredUser(), []);

  useEffect(() => {
    if (!role || !user) {
      router.replace("/login");
      return;
    }

    setMustChangePassword(Boolean(user.mustChangePassword));
    setIsBootstrapped(true);
  }, [role, router, user]);

  const validate = () => {
    if (!currentPassword) {
      return "Current password is required";
    }

    if (newPassword.length < 8) {
      return "New password must be at least 8 characters";
    }

    if (confirmPassword !== newPassword) {
      return "Confirm password must match new password";
    }

    return "";
  };

  const onCancel = () => {
    if (mustChangePassword) {
      clearDemoSession();
      router.replace("/login");
      return;
    }

    if (role) {
      router.push(HOME_BY_ROLE[role]);
    } else {
      router.push("/login");
    }
  };

  const onSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    setError("");
    setSuccess("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to update password");
      }

      updateStoredUser({ mustChangePassword: false });
      setMustChangePassword(false);
      setSuccess("Password updated successfully");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      if (role) {
        window.setTimeout(() => {
          router.push(HOME_BY_ROLE[role]);
        }, 600);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to update password"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isBootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="h-12 w-56 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_56px_rgba(15,23,42,0.15)]">
        <div className="px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/55">
            Security
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-heading">Change Password</h1>
          <p className="mt-2 text-sm text-text/70">
            Update your account password to continue.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">
                Current Password
              </label>
              <Input
                className="h-12"
                disabled={isSubmitting}
                onChange={(event) => setCurrentPassword(event.target.value)}
                type="password"
                value={currentPassword}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">
                New Password
              </label>
              <Input
                className="h-12"
                disabled={isSubmitting}
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                value={newPassword}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-heading">
                Confirm Password
              </label>
              <Input
                className="h-12"
                disabled={isSubmitting}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                value={confirmPassword}
              />
            </div>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {success}
            </p>
          ) : null}
        </div>

        <div className="border-t border-border bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <Button
              className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
              disabled={isSubmitting}
              onClick={onCancel}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              className="h-11 min-w-[160px] bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
              disabled={isSubmitting}
              onClick={() => {
                void onSubmit();
              }}
            >
              {isSubmitting ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";
import { authHeaders, updateStoredUser } from "@/models/rbac";
import { notificationsByRole, studentSummary } from "@/models/mockData";

export default function StudentDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [securitySuccess, setSecuritySuccess] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isSecurityModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isSecurityModalOpen]);

  const closeSecurityModal = () => {
    if (isUpdatingPassword) {
      return;
    }

    setIsSecurityModalOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSecurityError("");
    setSecuritySuccess("");
  };

  const validateSecurityForm = () => {
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

  const updatePassword = async () => {
    if (isUpdatingPassword) {
      return;
    }

    setSecurityError("");
    setSecuritySuccess("");

    const validationError = validateSecurityForm();
    if (validationError) {
      setSecurityError(validationError);
      return;
    }

    setIsUpdatingPassword(true);
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
      setSecuritySuccess("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setSecurityError(
        error instanceof Error ? error.message : "Failed to update password"
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-8 w-16" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-heading">Student Dashboard</h1>
        <p className="mt-2 text-sm text-text/75">Your academic support overview for this week.</p>
      </div>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Card accent>
          <p className="text-sm text-text/72">Notifications</p>
          <p className="mt-2 text-3xl font-semibold text-heading">{studentSummary.notifications}</p>
        </Card>
        <Card accent>
          <p className="text-sm text-text/72">Bookings</p>
          <p className="mt-2 text-3xl font-semibold text-heading">{studentSummary.bookings}</p>
        </Card>
        <Card accent>
          <p className="text-sm text-text/72">Posts</p>
          <p className="mt-2 text-3xl font-semibold text-heading">{studentSummary.posts}</p>
        </Card>
        <Card accent>
          <p className="text-sm text-text/72">Points</p>
          <p className="mt-2 text-3xl font-semibold text-heading">{studentSummary.points}</p>
        </Card>
      </section>

      <Card title="Recent Alerts">
        <ul className="space-y-3">
          {notificationsByRole.STUDENT.slice(0, 3).map((item) => (
            <li className="rounded-2xl bg-tint p-3.5" key={item.id}>
              <p className="text-sm font-medium text-text">{item.title}</p>
              <p className="mt-1 text-xs text-text/72">{item.time}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Security Settings">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text/75">
            Keep your account secure by changing your password regularly.
          </p>
          <Button
            className="h-11 min-w-[160px] bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
            onClick={() => setIsSecurityModalOpen(true)}
          >
            Change Password
          </Button>
        </div>
      </Card>

      {isSecurityModalOpen ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isUpdatingPassword) {
              closeSecurityModal();
            }
          }}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-white shadow-[0_18px_36px_rgba(15,23,42,0.2)]"
            role="dialog"
          >
            <div className="px-6 py-6">
              <p className="text-lg font-semibold text-heading">Change Password</p>
              <p className="mt-2 text-sm text-text/70">
                Update your password for better account security.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-heading">
                    Current Password
                  </label>
                  <Input
                    className="h-12"
                    disabled={isUpdatingPassword}
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
                    disabled={isUpdatingPassword}
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
                    disabled={isUpdatingPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    type="password"
                    value={confirmPassword}
                  />
                </div>
              </div>

              {securityError ? (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {securityError}
                </p>
              ) : null}

              {securitySuccess ? (
                <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {securitySuccess}
                </p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2.5 border-t border-border bg-white px-6 py-4">
              <Button
                className="h-11 min-w-[112px] border-slate-300 bg-white px-5 text-heading hover:bg-slate-50"
                disabled={isUpdatingPassword}
                onClick={closeSecurityModal}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                className="h-11 min-w-[160px] bg-[#034aa6] px-5 text-white shadow-[0_8px_24px_rgba(3,74,166,0.24)] hover:bg-[#0339a6]"
                disabled={isUpdatingPassword}
                onClick={() => {
                  void updatePassword();
                }}
              >
                {isUpdatingPassword ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


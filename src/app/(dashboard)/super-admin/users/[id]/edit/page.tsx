"use client";

import { useRouter, useParams, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { UserForm, type UserFormValues } from "@/components/forms/UserForm";
import type { UserRole } from "@/types/user";

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

function toUserRole(value: string | null): UserRole | undefined {
  const roles: readonly UserRole[] = [
    "Super Admin",
    "Department Admin",
    "Lecturer",
    "Student",
    "Lost Item Staff"
  ];
  return value && roles.includes(value as UserRole) ? (value as UserRole) : undefined;
}

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const userId = params.id as string;

  const name = searchParams.get("name") ?? "";
  const email = searchParams.get("email") ?? "";
  const role = toUserRole(searchParams.get("role"));
  const status = searchParams.get("status") ?? "";
  const { firstName, lastName } = splitFullName(name);

  const defaultValues: Partial<UserFormValues> = {
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    email: email || undefined,
    role,
    isActive: status !== "Inactive"
  };

  const handleSubmit = async (data: UserFormValues) => {
    try {
      // API call to update user
      console.log("Updating user:", userId, data);
      // await updateUser(userId, data);
      router.push("/super-admin/users");
    } catch (error) {
      console.error("Error updating user:", error);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit User"
        description="Update user details and permissions."
        showBreadcrumbs
        backHref="/super-admin/users"
      />
      <Card title="User Information">
        <UserForm
          mode="edit"
          defaultValues={defaultValues}
          submitLabel="Update User"
          onSubmit={handleSubmit}
        />
      </Card>
    </div>
  );
}

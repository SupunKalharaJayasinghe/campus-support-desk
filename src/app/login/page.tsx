"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { demoUsers } from "@/lib/mockData";
import {
  HOME_BY_ROLE,
  persistDemoSession,
  readStoredRole,
  roleLabel,
} from "@/lib/rbac";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const role = readStoredRole();
    if (role) {
      router.replace(HOME_BY_ROLE[role]);
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Demo Login</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Choose a role to continue</h1>
          <p className="mt-2 text-sm text-slate-600">
            This is a UI-only login simulation. No backend authentication is used.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {demoUsers.map((user) => (
            <Card key={user.id}>
              <p className="text-xs uppercase tracking-wide text-slate-400">{roleLabel(user.role)}</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">{user.name}</h2>
              <p className="mt-1 text-sm text-slate-600">Workspace: {HOME_BY_ROLE[user.role]}</p>
              <div className="mt-4">
                <Button
                  onClick={() => {
                    persistDemoSession(user);
                    router.push(HOME_BY_ROLE[user.role]);
                  }}
                >
                  Continue as {roleLabel(user.role)}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

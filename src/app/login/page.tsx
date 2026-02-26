"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import { demoUsers } from "@/lib/mockData";
import {
  HOME_BY_ROLE,
  persistDemoSession,
  readStoredRole,
  roleLabel,
} from "@/lib/rbac";

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const role = readStoredRole();
    if (role) {
      router.replace(HOME_BY_ROLE[role]);
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-bg py-16">
      <Container size="6xl">
        <div className="mb-10">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-text/68">Demo Login</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-heading">Choose a role to continue</h1>
          <p className="mt-3 text-sm text-text/75">
            This is a UI-only login simulation. No backend authentication is used.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {demoUsers.map((user) => (
            <Card
              className="transition-all hover:border-primaryHover hover:shadow-shadowHover focus-within:border-primaryHover focus-within:ring-2 focus-within:ring-focus"
              key={user.id}
            >
              <p className="text-xs uppercase tracking-[0.14em] text-text/68">{roleLabel(user.role)}</p>
              <h2 className="mt-2 text-lg font-semibold text-heading">{user.name}</h2>
              <p className="mt-1 text-sm text-text/72">Workspace: {HOME_BY_ROLE[user.role]}</p>
              <div className="mt-4">
                <Button
                  className={cn("w-full justify-center")}
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
      </Container>
    </div>
  );
}

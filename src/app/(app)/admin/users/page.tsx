"use client";

import { useState } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import { adminUsersSeed } from "@/lib/mockData";
import type { AppRole, DemoUser } from "@/lib/rbac";

function roleVariant(role: AppRole) {
  if (role === "SUPER_ADMIN") {
    return "danger" as const;
  }
  if (role === "LECTURER") {
    return "warning" as const;
  }
  if (role === "LOST_ITEM_STAFF") {
    return "success" as const;
  }
  return "neutral" as const;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<DemoUser[]>(adminUsersSeed);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Users</h1>
        <p className="text-sm text-text/72">Manage demo users and role assignments.</p>
      </div>
      <Card>
        <div className="space-y-3">
          {users.map((user) => (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4" key={user.id}>
              <div>
                <p className="text-sm font-semibold text-heading">{user.name}</p>
                <p className="text-xs text-text/72">{user.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={roleVariant(user.role)}>{user.role}</Badge>
                <Select
                  className="w-44"
                  onChange={(event) =>
                    setUsers((prev) =>
                      prev.map((item) =>
                        item.id === user.id ? { ...item, role: event.target.value as AppRole } : item
                      )
                    )
                  }
                  value={user.role}
                >
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  <option value="LECTURER">LECTURER</option>
                  <option value="LOST_ITEM_STAFF">LOST_ITEM_STAFF</option>
                  <option value="STUDENT">STUDENT</option>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

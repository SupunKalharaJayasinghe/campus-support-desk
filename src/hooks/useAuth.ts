import { useState } from "react";
import type { User, UserRole } from "@/types";

const mockUser: User = {
  id: "U-0001",
  name: "Jordan Parker",
  email: "jordan.parker@campus.edu",
  role: "Super Admin",
  status: "Active"
};

export function useAuth() {
  const [user] = useState<User>(mockUser);

  const switchRole = (role: UserRole) => {
    user.role = role;
  };

  return {
    user,
    isAuthenticated: true,
    switchRole
  };
}

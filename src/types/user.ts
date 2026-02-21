export type UserRole =
  | "Super Admin"
  | "Department Admin"
  | "Lecturer"
  | "Student"
  | "Lost Item Staff";

export type UserStatus = "Active" | "Inactive" | "Pending";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

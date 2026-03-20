"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Edit3,
  Eye,
  FilterX,
  KeyRound,
  MoreVertical,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";
import TablePagination from "@/components/admin/TablePagination";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/ToastProvider";

type PageSize = 10 | 25 | 50 | 100;

const ROLE_OPTIONS = [
  "Student",
  "Lecturer",
  "Lecture Incharge",
  "Lecture Supporter",
  "Lost Item Officer",
  "Admin",
] as const;

const STATUS_OPTIONS = ["Active", "Inactive", "Suspended"] as const;
const STUDENT_YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;
const SEMESTER_OPTIONS = ["Semester 1", "Semester 2"] as const;
const BADGE_OPTIONS = ["2025", "2026"] as const;
const ADMIN_PERMISSIONS = ["Manage Faculty", "Manage Users", "View Reports"] as const;

const FACULTY_PROGRAMS: Record<string, string[]> = {
  "Faculty of Computing": ["BSc Computer Science", "BSc Software Engineering"],
  "Faculty of Engineering": ["BEng Mechanical Engineering", "BEng Electrical Engineering"],
  "Faculty of Business": ["BBA Business Administration", "BSc Finance"],
};

const PROGRAM_MODULES: Record<string, string[]> = {
  "BSc Computer Science": ["Data Structures", "Database Systems", "Web Engineering", "Software Project"],
  "BSc Software Engineering": ["Software Architecture", "Quality Assurance", "Requirements Engineering", "Agile Development"],
  "BEng Mechanical Engineering": ["Thermodynamics", "Mechanics", "Machine Design", "Manufacturing Systems"],
  "BEng Electrical Engineering": ["Circuit Analysis", "Power Systems", "Signals and Systems", "Embedded Systems"],
  "BBA Business Administration": ["Organizational Behavior", "Operations Management", "Business Communication", "Strategic Management"],
  "BSc Finance": ["Corporate Finance", "Investment Analysis", "Risk Management", "Financial Reporting"],
};

type UserRole = (typeof ROLE_OPTIONS)[number];
type UserStatus = (typeof STATUS_OPTIONS)[number];
type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

interface UserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  campusId: string;
  role: UserRole;
  faculty?: string;
  degreeProgram?: string;
  status: UserStatus;
  badge?: string;
  year?: string;
  semester?: string;
  modules?: string[];
  officeLocation?: string;
  permissions?: AdminPermission[];
}

interface UserFormState {
  firstName: string;
  lastName: string;
  email: string;
  campusId: string;
  role: UserRole;
  status: UserStatus;
  faculty: string;
  degreeProgram: string;
  badge: string;
  year: string;
  semester: string;
  modules: string[];
  officeLocation: string;
  permissions: AdminPermission[];
}

type FormField = keyof UserFormState;
type PrimaryRoleTab =
  | "administrator"
  | "student"
  | "lost_item_officer"
  | "lecturer";
type LecturerRoleTab = "lecturer" | "lecture_incharge" | "lecture_supporter";

const PRIMARY_TABS: Array<{ key: PrimaryRoleTab; label: string }> = [
  { key: "administrator", label: "Administrator" },
  { key: "student", label: "Student" },
  { key: "lost_item_officer", label: "Lost Item Officer" },
  { key: "lecturer", label: "Lecturer" },
];

const LECTURER_TABS: Array<{ key: LecturerRoleTab; label: string }> = [
  { key: "lecturer", label: "Lecturer" },
  { key: "lecture_incharge", label: "Lecture Incharge" },
  { key: "lecture_supporter", label: "Lecture Supporter" },
];

const PRIMARY_TAB_ROLE: Record<Exclude<PrimaryRoleTab, "lecturer">, UserRole> = {
  administrator: "Admin",
  student: "Student",
  lost_item_officer: "Lost Item Officer",
};

const LECTURER_TAB_ROLE: Record<LecturerRoleTab, UserRole> = {
  lecturer: "Lecturer",
  lecture_incharge: "Lecture Incharge",
  lecture_supporter: "Lecture Supporter",
};

const SAMPLE_USERS: UserRecord[] = [
  {
    id: "USR-001",
    firstName: "Nethmi",
    lastName: "Perera",
    email: "nethmi.perera@campus.edu",
    campusId: "IT23123456",
    role: "Student",
    faculty: "Faculty of Computing",
    degreeProgram: "BSc Computer Science",
    status: "Active",
    badge: "2026",
    year: "2nd Year",
    semester: "Semester 1",
  },
  {
    id: "USR-002",
    firstName: "Sahan",
    lastName: "Fernando",
    email: "sahan.fernando@campus.edu",
    campusId: "IT23124002",
    role: "Student",
    faculty: "Faculty of Engineering",
    degreeProgram: "BEng Mechanical Engineering",
    status: "Inactive",
    badge: "2025",
    year: "3rd Year",
    semester: "Semester 2",
  },
  {
    id: "USR-003",
    firstName: "Amal",
    lastName: "Gunasekara",
    email: "amal.gunasekara@campus.edu",
    campusId: "LEC10021",
    role: "Lecturer",
    faculty: "Faculty of Computing",
    degreeProgram: "BSc Software Engineering",
    status: "Active",
    modules: ["Software Architecture", "Agile Development"],
  },
  {
    id: "USR-004",
    firstName: "Ishara",
    lastName: "Rathnayake",
    email: "ishara.rathnayake@campus.edu",
    campusId: "LEC10077",
    role: "Lecture Incharge",
    faculty: "Faculty of Engineering",
    degreeProgram: "BEng Electrical Engineering",
    status: "Active",
    modules: ["Power Systems", "Embedded Systems"],
  },
  {
    id: "USR-005",
    firstName: "Kumudu",
    lastName: "Silva",
    email: "kumudu.silva@campus.edu",
    campusId: "SUP20011",
    role: "Lecture Supporter",
    faculty: "Faculty of Business",
    degreeProgram: "BBA Business Administration",
    status: "Suspended",
    modules: ["Business Communication"],
  },
  {
    id: "USR-006",
    firstName: "Ruwan",
    lastName: "Herath",
    email: "ruwan.herath@campus.edu",
    campusId: "LIO30991",
    role: "Lost Item Officer",
    status: "Active",
    officeLocation: "Student Services Counter",
  },
  {
    id: "USR-007",
    firstName: "Nimali",
    lastName: "Wijesinghe",
    email: "nimali.wijesinghe@campus.edu",
    campusId: "ADM00102",
    role: "Admin",
    status: "Active",
    permissions: ["Manage Faculty", "Manage Users", "View Reports"],
  },
  {
    id: "USR-008",
    firstName: "Tharindu",
    lastName: "Jayawardena",
    email: "tharindu.jayawardena@campus.edu",
    campusId: "LEC10911",
    role: "Lecturer",
    faculty: "Faculty of Computing",
    degreeProgram: "BSc Computer Science",
    status: "Inactive",
    modules: ["Data Structures", "Database Systems"],
  },
  {
    id: "USR-009",
    firstName: "Yasara",
    lastName: "Madushani",
    email: "yasara.madushani@campus.edu",
    campusId: "IT24111234",
    role: "Student",
    faculty: "Faculty of Business",
    degreeProgram: "BSc Finance",
    status: "Suspended",
    badge: "2026",
    year: "1st Year",
    semester: "Semester 2",
  },
  {
    id: "USR-010",
    firstName: "Hashan",
    lastName: "Karunathilaka",
    email: "hashan.karunathilaka@campus.edu",
    campusId: "LIO30021",
    role: "Lost Item Officer",
    status: "Inactive",
    officeLocation: "Main Security Office",
  },
];

function isStudentRole(role: UserRole) {
  return role === "Student";
}

function isTeachingRole(role: UserRole) {
  return (
    role === "Lecturer" ||
    role === "Lecture Incharge" ||
    role === "Lecture Supporter"
  );
}

function createEmptyForm(): UserFormState {
  return {
    firstName: "",
    lastName: "",
    email: "",
    campusId: "",
    role: "Student",
    status: "Active",
    faculty: "",
    degreeProgram: "",
    badge: "",
    year: "",
    semester: "",
    modules: [],
    officeLocation: "",
    permissions: [],
  };
}

function toFormState(user: UserRecord): UserFormState {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    campusId: user.campusId,
    role: user.role,
    status: user.status,
    faculty: user.faculty ?? "",
    degreeProgram: user.degreeProgram ?? "",
    badge: user.badge ?? "",
    year: user.year ?? "",
    semester: user.semester ?? "",
    modules: user.modules ?? [],
    officeLocation: user.officeLocation ?? "",
    permissions: user.permissions ?? [],
  };
}

function toUserRecord(form: UserFormState, id: string): UserRecord {
  const base: UserRecord = {
    id,
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim(),
    campusId: form.campusId.trim(),
    role: form.role,
    status: form.status,
  };

  if (isStudentRole(form.role)) {
    return {
      ...base,
      faculty: form.faculty,
      degreeProgram: form.degreeProgram,
      badge: form.badge,
      year: form.year,
      semester: form.semester,
    };
  }

  if (isTeachingRole(form.role)) {
    return {
      ...base,
      faculty: form.faculty,
      degreeProgram: form.degreeProgram,
      modules: form.modules,
    };
  }

  if (form.role === "Lost Item Officer") {
    return {
      ...base,
      officeLocation: form.officeLocation.trim(),
    };
  }

  if (form.role === "Admin") {
    return {
      ...base,
      permissions: form.permissions,
    };
  }

  return base;
}

function fullName(user: UserRecord) {
  return `${user.firstName} ${user.lastName}`;
}

function initials(user: UserRecord) {
  return `${user.firstName.charAt(0).toUpperCase()}${user.lastName.charAt(0).toUpperCase()}`;
}

function roleBadgeClass(role: UserRole) {
  const map: Record<UserRole, string> = {
    Student: "bg-[#034AA6]/10 text-[#034AA6] border border-[#034AA6]/20",
    Lecturer: "bg-[#26150F]/10 text-[#26150F] border border-black/15",
    "Lecture Incharge": "bg-[#26150F]/10 text-[#26150F] border border-black/15",
    "Lecture Supporter": "bg-[#26150F]/10 text-[#26150F] border border-black/15",
    "Lost Item Officer": "bg-[#034AA6]/10 text-[#034AA6] border border-[#034AA6]/20",
    Admin: "bg-[#034AA6]/12 text-[#034AA6] border border-[#034AA6]/25",
  };
  return map[role];
}

function statusBadgeClass(status: UserStatus) {
  const map: Record<UserStatus, string> = {
    Active: "bg-green-600/15 text-green-800 border border-green-700/25",
    Inactive: "bg-black/8 text-[#26150F]/85 border border-black/15",
    Suspended: "bg-red-600/15 text-red-800 border border-red-700/25",
  };
  return map[status];
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>(SAMPLE_USERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [facultyFilter, setFacultyFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(1);
  const [activePrimaryTab, setActivePrimaryTab] = useState<PrimaryRoleTab>(
    "administrator"
  );
  const [activeLecturerTab, setActiveLecturerTab] =
    useState<LecturerRoleTab>("lecturer");
  const [actionMenuUserId, setActionMenuUserId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: "add" | "edit"; userId?: string } | null>(null);
  const [form, setForm] = useState<UserFormState>(createEmptyForm);
  const [errors, setErrors] = useState<Partial<Record<FormField, string>>>({});
  const supportsAcademicFilters =
    activePrimaryTab === "student" || activePrimaryTab === "lecturer";

  useEffect(() => {
    if (!actionMenuUserId) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-user-actions]")) {
        setActionMenuUserId(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [actionMenuUserId]);

  useEffect(() => {
    if (!modal) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      const firstInput = document.getElementById("firstName");
      firstInput?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setModal(null);
        setErrors({});
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [modal]);

  useEffect(() => {
    const debounceTimer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 350);

    return () => window.clearTimeout(debounceTimer);
  }, [searchQuery]);

  const facultyOptions = useMemo(() => {
    const set = new Set<string>(Object.keys(FACULTY_PROGRAMS));
    users.forEach((user) => {
      if (user.faculty) {
        set.add(user.faculty);
      }
    });
    return Array.from(set).sort();
  }, [users]);

  const programOptions = useMemo(() => {
    const set = new Set<string>();
    Object.values(FACULTY_PROGRAMS).forEach((programs) => {
      programs.forEach((program) => set.add(program));
    });
    users.forEach((user) => {
      if (user.degreeProgram) {
        set.add(user.degreeProgram);
      }
    });
    return Array.from(set).sort();
  }, [users]);

  const filteredProgramOptions = useMemo(() => {
    if (facultyFilter && FACULTY_PROGRAMS[facultyFilter]) {
      return FACULTY_PROGRAMS[facultyFilter];
    }
    return programOptions;
  }, [facultyFilter, programOptions]);

  const formProgramOptions = useMemo(() => {
    if (!form.faculty) {
      return [];
    }
    return FACULTY_PROGRAMS[form.faculty] ?? [];
  }, [form.faculty]);

  const moduleOptions = useMemo(() => {
    if (!form.degreeProgram) {
      return [];
    }
    return PROGRAM_MODULES[form.degreeProgram] ?? [];
  }, [form.degreeProgram]);

  const primaryTabCounts = useMemo(
    () =>
      ({
        administrator: users.filter((user) => user.role === "Admin").length,
        student: users.filter((user) => user.role === "Student").length,
        lost_item_officer: users.filter((user) => user.role === "Lost Item Officer")
          .length,
        lecturer: users.filter((user) =>
          user.role === "Lecturer" ||
          user.role === "Lecture Incharge" ||
          user.role === "Lecture Supporter"
        ).length,
      }) satisfies Record<PrimaryRoleTab, number>,
    [users]
  );

  const lecturerTabCounts = useMemo(
    () =>
      ({
        lecturer: users.filter((user) => user.role === "Lecturer").length,
        lecture_incharge: users.filter((user) => user.role === "Lecture Incharge")
          .length,
        lecture_supporter: users.filter((user) => user.role === "Lecture Supporter")
          .length,
      }) satisfies Record<LecturerRoleTab, number>,
    [users]
  );

  const visibleRole: UserRole =
    activePrimaryTab === "lecturer"
      ? LECTURER_TAB_ROLE[activeLecturerTab]
      : PRIMARY_TAB_ROLE[activePrimaryTab];

  const visibleRoleUsers = useMemo(
    () => users.filter((user) => user.role === visibleRole),
    [users, visibleRole]
  );

  const filteredUsers = useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();

    return visibleRoleUsers.filter((user) => {
      const queryTarget = `${fullName(user)} ${user.campusId} ${user.email}`.toLowerCase();
      if (query && !queryTarget.includes(query)) {
        return false;
      }
      if (supportsAcademicFilters && facultyFilter && user.faculty !== facultyFilter) {
        return false;
      }
      if (
        supportsAcademicFilters &&
        programFilter &&
        user.degreeProgram !== programFilter
      ) {
        return false;
      }
      if (statusFilter && user.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [
    debouncedSearchQuery,
    facultyFilter,
    programFilter,
    statusFilter,
    supportsAcademicFilters,
    visibleRoleUsers,
  ]);

  const activeFilterCount =
    (searchQuery.trim() ? 1 : 0) +
    (statusFilter ? 1 : 0) +
    (supportsAcademicFilters && facultyFilter ? 1 : 0) +
    (supportsAcademicFilters && programFilter ? 1 : 0);

  const activeRoleLabel =
    activePrimaryTab === "lecturer"
      ? LECTURER_TABS.find((tab) => tab.key === activeLecturerTab)?.label ??
        "Lecturer"
      : PRIMARY_TABS.find((tab) => tab.key === activePrimaryTab)?.label ??
        "User";

  const noUsersForSelectedRole = visibleRoleUsers.length === 0;

  const emptyStateTitle = noUsersForSelectedRole
    ? `No ${activeRoleLabel} users found`
    : "No users match the selected filters.";

  const emptyStateSubtitle =
    noUsersForSelectedRole && activePrimaryTab === "lecturer"
      ? "You can add a new user or adjust filters."
      : "Try adjusting filters or add a new user.";
  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedUsers = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize);

  const validateForm = () => {
    const nextErrors: Partial<Record<FormField, string>> = {};
    if (!form.firstName.trim()) nextErrors.firstName = "Required";
    if (!form.lastName.trim()) nextErrors.lastName = "Required";
    if (!form.email.trim()) nextErrors.email = "Required";
    if (!form.campusId.trim()) nextErrors.campusId = "Required";
    if (!form.role) nextErrors.role = "Required";
    if (!form.status) nextErrors.status = "Required";

    if (isStudentRole(form.role)) {
      if (!form.faculty) nextErrors.faculty = "Required";
      if (!form.degreeProgram) nextErrors.degreeProgram = "Required";
      if (!form.badge) nextErrors.badge = "Required";
      if (!form.year) nextErrors.year = "Required";
      if (!form.semester) nextErrors.semester = "Required";
    }

    if (isTeachingRole(form.role)) {
      if (!form.faculty) nextErrors.faculty = "Required";
      if (!form.degreeProgram) nextErrors.degreeProgram = "Required";
      if (form.modules.length === 0) nextErrors.modules = "Select at least one module";
    }

    if (form.role === "Lost Item Officer" && !form.officeLocation.trim()) {
      nextErrors.officeLocation = "Required";
    }

    if (form.role === "Admin" && form.permissions.length === 0) {
      nextErrors.permissions = "Select at least one permission";
    }

    setErrors(nextErrors);
    const isValid = Object.keys(nextErrors).length === 0;

    if (!isValid) {
      toast({
        title: "Failed",
        message: "Please complete the required user fields before saving.",
        variant: "error",
      });
    }

    return isValid;
  };

  const openAddModal = () => {
    setModal({ mode: "add" });
    setForm(createEmptyForm());
    setErrors({});
  };

  const openEditModal = (user: UserRecord) => {
    setModal({ mode: "edit", userId: user.id });
    setForm(toFormState(user));
    setErrors({});
  };

  const closeModal = () => {
    setModal(null);
    setErrors({});
  };

  const toggleModule = (moduleName: string) => {
    setForm((prev) => {
      const exists = prev.modules.includes(moduleName);
      return {
        ...prev,
        modules: exists
          ? prev.modules.filter((item) => item !== moduleName)
          : [...prev.modules, moduleName],
      };
    });
  };

  const togglePermission = (permission: AdminPermission) => {
    setForm((prev) => {
      const exists = prev.permissions.includes(permission);
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter((item) => item !== permission)
          : [...prev.permissions, permission],
      };
    });
  };

  const saveUser = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) {
      return;
    }

    if (modal?.mode === "edit" && modal.userId) {
      setUsers((prev) =>
        prev.map((user) =>
          user.id === modal.userId ? toUserRecord(form, modal.userId) : user
        )
      );
      toast({
        title: "Saved",
        message: "User updated successfully.",
        variant: "success",
      });
    } else {
      const nextId = `USR-${String(users.length + 1).padStart(3, "0")}`;
      setUsers((prev) => [...prev, toUserRecord(form, nextId)]);
      toast({
        title: "Saved",
        message: "User added successfully.",
        variant: "success",
      });
    }

    closeModal();
  };

  const runAction = (
    action: "view" | "edit" | "reset" | "toggle" | "delete",
    user: UserRecord
  ) => {
    if (action === "view") {
      console.log("View user", user.id);
    }
    if (action === "edit") {
      openEditModal(user);
    }
    if (action === "reset") {
      console.log("Reset password", user.id);
      toast({
        title: "Info",
        message: "Password reset has been queued.",
        variant: "info",
      });
    }
    if (action === "toggle") {
      setUsers((prev) =>
        prev.map((entry) =>
          entry.id === user.id
            ? {
                ...entry,
                status: entry.status === "Active" ? "Inactive" : "Active",
              }
            : entry
        )
      );
      toast({
        title: "Saved",
        message: `${fullName(user)} status updated.`,
        variant: "success",
      });
    }
    if (action === "delete") {
      setUsers((prev) => prev.filter((entry) => entry.id !== user.id));
      toast({
        title: "Deleted",
        message: `${fullName(user)} was removed.`,
        variant: "success",
      });
    }
    setActionMenuUserId(null);
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#0A0A0A]">Users Management</h1>
          <p className="mt-1 text-sm text-[#26150F]/75">Manage students, lecturers, and staff accounts.</p>
        </div>
        <Button className="gap-2 bg-[#034AA6] text-[#D9D9D9] hover:bg-[#0339A6]" onClick={openAddModal} type="button">
          <UserPlus size={16} />
          Add User
        </Button>
      </section>

      <section className="rounded-3xl border border-black/15 bg-white p-5 shadow-[0_8px_24px_rgba(38,21,15,0.08)] lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="w-full lg:flex-1">
            <Input
              className="h-11 rounded-xl"
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name, campus ID, or email…"
              value={searchQuery}
            />
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:ml-auto lg:w-auto lg:flex-nowrap">
            {supportsAcademicFilters ? (
              <Select
                className="h-11 w-full rounded-xl sm:w-44"
                onChange={(event) => {
                  setFacultyFilter(event.target.value);
                  setProgramFilter("");
                  setPage(1);
                }}
                value={facultyFilter}
              >
                <option value="">All Faculties</option>
                {facultyOptions.map((faculty) => (
                  <option key={faculty} value={faculty}>
                    {faculty}
                  </option>
                ))}
              </Select>
            ) : null}

            {supportsAcademicFilters ? (
              <Select
                className="h-11 w-full rounded-xl sm:w-48"
                onChange={(event) => {
                  setProgramFilter(event.target.value);
                  setPage(1);
                }}
                value={programFilter}
              >
                <option value="">All Degree Programs</option>
                {filteredProgramOptions.map((program) => (
                  <option key={program} value={program}>
                    {program}
                  </option>
                ))}
              </Select>
            ) : null}

            <Select
              className="h-11 w-full rounded-xl sm:w-40"
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              value={statusFilter}
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>

            <Button
              className="h-11 w-full gap-2 rounded-xl border-black/20 bg-white px-3 text-[#26150F] hover:border-[#0339A6]/60 hover:bg-[#034AA6]/5 hover:text-[#0339A6] sm:w-auto"
              onClick={() => {
                setPage(1);
                setSearchQuery("");
                setFacultyFilter("");
                setProgramFilter("");
                setStatusFilter("");
              }}
              type="button"
              variant="secondary"
            >
              <FilterX size={15} />
              Clear
            </Button>
          </div>
        </div>

        {activeFilterCount > 0 ? (
          <p className="mt-3 text-xs text-[#26150F]/60">
            {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
          </p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-black/15 bg-white p-4 shadow-[0_8px_24px_rgba(38,21,15,0.08)] sm:p-5">
        <div className="rounded-2xl border border-black/12 bg-[#D9D9D9]/35 p-2">
          <div className="overflow-x-auto">
            <div
              aria-label="User roles"
              className="grid min-w-[720px] grid-cols-4 gap-2"
              role="tablist"
            >
              {PRIMARY_TABS.map((tab) => {
                const active = activePrimaryTab === tab.key;
                return (
                  <button
                    aria-selected={active}
                    className={[
                      "inline-flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#034AA6]/35",
                      active
                        ? "border-[#034AA6]/45 bg-[#034AA6]/12 text-[#034AA6]"
                        : "border-transparent bg-white/80 text-[#26150F]/82 hover:border-black/15 hover:bg-white hover:text-[#0339A6]",
                    ].join(" ")}
                    key={tab.key}
                    onClick={() => {
                      if (tab.key !== activePrimaryTab) {
                        if (tab.key !== "lecturer") {
                          setActiveLecturerTab("lecturer");
                        }
                        setPage(1);
                        setActivePrimaryTab(tab.key);
                        setSearchQuery("");
                        setFacultyFilter("");
                        setProgramFilter("");
                        setStatusFilter("");
                      }
                    }}
                    role="tab"
                    type="button"
                  >
                    <span>{tab.label}</span>
                    <span className="rounded-full border border-black/12 bg-black/5 px-2 py-0.5 text-xs text-[#26150F]/75">
                      {primaryTabCounts[tab.key]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          aria-hidden={activePrimaryTab !== "lecturer"}
          className={[
            "overflow-hidden transition-all duration-300 ease-out",
            activePrimaryTab === "lecturer"
              ? "mt-6 max-h-56 opacity-100"
              : "mt-0 max-h-0 opacity-0",
          ].join(" ")}
        >
          <div className="rounded-2xl border border-black/12 bg-[#D9D9D9]/30 p-4 shadow-[0_6px_18px_rgba(38,21,15,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#26150F]/58">
              Lecturer Roles
            </p>
            <div className="mt-3 overflow-x-auto">
              <div
                aria-label="Lecturer sub-roles"
                className="grid min-w-[440px] grid-cols-3 gap-2 rounded-xl border border-black/10 bg-white/80 p-1.5"
                role="tablist"
              >
                {LECTURER_TABS.map((tab) => {
                  const active = activeLecturerTab === tab.key;
                  return (
                    <button
                      aria-selected={active}
                      className={[
                        "inline-flex min-h-10 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#034AA6]/35",
                        active
                          ? "border-[#034AA6]/40 bg-white text-[#034AA6] shadow-[0_4px_12px_rgba(38,21,15,0.08)]"
                          : "border-transparent bg-transparent text-[#26150F]/78 hover:border-black/15 hover:bg-white/70 hover:text-[#0339A6]",
                      ].join(" ")}
                      key={tab.key}
                      onClick={() => {
                        setPage(1);
                        setActiveLecturerTab(tab.key);
                      }}
                      role="tab"
                      tabIndex={activePrimaryTab === "lecturer" ? 0 : -1}
                      type="button"
                    >
                      <span>{tab.label}</span>
                      <span className="ml-2 rounded-full border border-black/12 bg-black/5 px-2 py-0.5 text-xs text-[#26150F]/72">
                        {lecturerTabCounts[tab.key]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-black/15 bg-white shadow-[0_8px_24px_rgba(38,21,15,0.08)]">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-black/10 bg-[#034AA6]/6">
              <tr className="text-left text-xs uppercase tracking-[0.08em] text-[#26150F]/72">
                <th className="px-5 py-4 font-medium">Avatar</th>
                <th className="px-5 py-4 font-medium">Name</th>
                <th className="px-5 py-4 font-medium">Role</th>
                <th className="px-5 py-4 font-medium">Faculty</th>
                <th className="px-5 py-4 font-medium">Degree Program</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td className="px-5 py-12" colSpan={7}>
                    <div className="mx-auto flex max-w-md flex-col items-center text-center">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-black/15 bg-[#034AA6]/10 text-[#034AA6]">
                        <Users size={20} />
                      </span>
                      <p className="mt-4 text-base font-semibold text-[#0A0A0A]">
                        {emptyStateTitle}
                      </p>
                      <p className="mt-1 text-sm text-[#26150F]/70">
                        {emptyStateSubtitle}
                      </p>
                      <Button
                        className="mt-4 gap-2 bg-[#034AA6] text-[#D9D9D9] hover:bg-[#0339A6]"
                        onClick={openAddModal}
                        type="button"
                      >
                        <UserPlus size={15} />
                        Add User
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedUsers.map((user) => (
                  <tr className="border-b border-black/8 text-sm text-[#26150F] transition-colors hover:bg-[#034AA6]/4" key={user.id}>
                    <td className="px-5 py-4">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/15 bg-[#034AA6]/12 text-xs font-semibold text-[#034AA6]">
                        {initials(user)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#0A0A0A]">{fullName(user)}</p>
                      <p className="mt-0.5 text-xs text-[#26150F]/70">{user.email}</p>
                      <p className="mt-0.5 text-xs text-[#26150F]/65">{user.campusId}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={["inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", roleBadgeClass(user.role)].join(" ")}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[#26150F]/82">{user.faculty ?? "—"}</td>
                    <td className="px-5 py-4 text-[#26150F]/82">{user.degreeProgram ?? "—"}</td>
                    <td className="px-5 py-4">
                      <span className={["inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", statusBadgeClass(user.status)].join(" ")}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end">
                        <div className="relative" data-user-actions>
                          <button
                            aria-expanded={actionMenuUserId === user.id}
                            aria-label={`User actions for ${fullName(user)}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/15 text-[#26150F]/80 transition-colors duration-200 hover:border-[#034AA6]/55 hover:text-[#0339A6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#034AA6]/30"
                            onClick={() => setActionMenuUserId((prev) => (prev === user.id ? null : user.id))}
                            type="button"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {actionMenuUserId === user.id ? (
                            <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-2xl border border-black/12 bg-white p-1.5 shadow-[0_10px_28px_rgba(38,21,15,0.12)]">
                              <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[#26150F] transition-colors hover:bg-[#034AA6]/8 hover:text-[#0339A6]" onClick={() => runAction("view", user)} type="button">
                                <Eye size={15} />
                                View
                              </button>
                              <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[#26150F] transition-colors hover:bg-[#034AA6]/8 hover:text-[#0339A6]" onClick={() => runAction("edit", user)} type="button">
                                <Edit3 size={15} />
                                Edit
                              </button>
                              <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[#26150F] transition-colors hover:bg-[#034AA6]/8 hover:text-[#0339A6]" onClick={() => runAction("reset", user)} type="button">
                                <KeyRound size={15} />
                                Reset Password
                              </button>
                              <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[#26150F] transition-colors hover:bg-[#034AA6]/8 hover:text-[#0339A6]" onClick={() => runAction("toggle", user)} type="button">
                                {user.status === "Active" ? <UserX size={15} /> : <UserCheck size={15} />}
                                {user.status === "Active" ? "Deactivate" : "Activate"}
                              </button>
                              <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-700 transition-colors hover:bg-red-50" onClick={() => runAction("delete", user)} type="button">
                                <Trash2 size={15} />
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4">
          <TablePagination
            className="mt-0 border-t-0 pt-0"
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value as PageSize);
              setPage(1);
            }}
            page={safePage}
            pageCount={pageCount}
            pageSize={pageSize}
            totalItems={filteredUsers.length}
          />
        </div>
      </section>

      {modal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
          role="presentation"
        >
          <div
            aria-labelledby="user-modal-title"
            aria-modal="true"
            className="w-full max-w-[92vw] rounded-2xl border border-black/15 bg-white p-6 shadow-2xl transition-all duration-200 ease-out sm:max-w-xl sm:p-8"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[#0A0A0A]" id="user-modal-title">
                  {modal.mode === "add" ? "Add User" : "Edit User"}
                </h2>
                <p className="mt-1 text-sm text-[#26150F]/72">
                  Enter account details for this user.
                </p>
              </div>
              <button
                aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/15 text-[#26150F]/80 transition-colors duration-200 hover:border-[#034AA6]/60 hover:text-[#0339A6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#034AA6]/30"
                onClick={closeModal}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            <form className="mt-6 space-y-4" id="user-form" onSubmit={saveUser}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-[#26150F]" htmlFor="firstName">
                    First Name
                  </label>
                  <Input
                    id="firstName"
                    onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
                    value={form.firstName}
                  />
                  {errors.firstName ? <p className="mt-1 text-xs text-[#0339A6]">{errors.firstName}</p> : null}
                </div>
                <div>
                  <label className="text-sm font-medium text-[#26150F]" htmlFor="lastName">
                    Last Name
                  </label>
                  <Input
                    id="lastName"
                    onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
                    value={form.lastName}
                  />
                  {errors.lastName ? <p className="mt-1 text-xs text-[#0339A6]">{errors.lastName}</p> : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-[#26150F]" htmlFor="email">
                    Campus Email
                  </label>
                  <Input
                    id="email"
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    value={form.email}
                  />
                  {errors.email ? <p className="mt-1 text-xs text-[#0339A6]">{errors.email}</p> : null}
                </div>
                <div>
                  <label className="text-sm font-medium text-[#26150F]" htmlFor="campusId">
                    Campus ID
                  </label>
                  <Input
                    id="campusId"
                    onChange={(event) => setForm((prev) => ({ ...prev, campusId: event.target.value }))}
                    value={form.campusId}
                  />
                  {errors.campusId ? <p className="mt-1 text-xs text-[#0339A6]">{errors.campusId}</p> : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-[#26150F]" htmlFor="role">
                    Role
                  </label>
                  <Select
                    id="role"
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        role: event.target.value as UserRole,
                        faculty: "",
                        degreeProgram: "",
                        badge: "",
                        year: "",
                        semester: "",
                        modules: [],
                        officeLocation: "",
                        permissions: [],
                      }))
                    }
                    value={form.role}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </Select>
                  {errors.role ? <p className="mt-1 text-xs text-[#0339A6]">{errors.role}</p> : null}
                </div>
                <div>
                  <label className="text-sm font-medium text-[#26150F]" htmlFor="status">
                    Status
                  </label>
                  <Select
                    id="status"
                    onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as UserStatus }))}
                    value={form.status}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Select>
                  {errors.status ? <p className="mt-1 text-xs text-[#0339A6]">{errors.status}</p> : null}
                </div>
              </div>

              {isStudentRole(form.role) ? (
                <div className="space-y-4 rounded-2xl border border-black/10 bg-[#034AA6]/4 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-[#26150F]" htmlFor="studentFaculty">
                        Faculty
                      </label>
                      <Select
                        id="studentFaculty"
                        onChange={(event) => setForm((prev) => ({ ...prev, faculty: event.target.value, degreeProgram: "" }))}
                        value={form.faculty}
                      >
                        <option value="">Select Faculty</option>
                        {facultyOptions.map((faculty) => (
                          <option key={faculty} value={faculty}>
                            {faculty}
                          </option>
                        ))}
                      </Select>
                      {errors.faculty ? <p className="mt-1 text-xs text-[#0339A6]">{errors.faculty}</p> : null}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#26150F]" htmlFor="studentProgram">
                        Degree Program
                      </label>
                      <Select
                        id="studentProgram"
                        onChange={(event) => setForm((prev) => ({ ...prev, degreeProgram: event.target.value }))}
                        value={form.degreeProgram}
                      >
                        <option value="">Select Program</option>
                        {formProgramOptions.map((program) => (
                          <option key={program} value={program}>
                            {program}
                          </option>
                        ))}
                      </Select>
                      {errors.degreeProgram ? <p className="mt-1 text-xs text-[#0339A6]">{errors.degreeProgram}</p> : null}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="text-sm font-medium text-[#26150F]" htmlFor="badge">
                        Badge / Intake
                      </label>
                      <Select
                        id="badge"
                        onChange={(event) => setForm((prev) => ({ ...prev, badge: event.target.value }))}
                        value={form.badge}
                      >
                        <option value="">Select Badge</option>
                        {BADGE_OPTIONS.map((badge) => (
                          <option key={badge} value={badge}>
                            {badge}
                          </option>
                        ))}
                      </Select>
                      {errors.badge ? <p className="mt-1 text-xs text-[#0339A6]">{errors.badge}</p> : null}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#26150F]" htmlFor="year">
                        Year
                      </label>
                      <Select
                        id="year"
                        onChange={(event) => setForm((prev) => ({ ...prev, year: event.target.value }))}
                        value={form.year}
                      >
                        <option value="">Select Year</option>
                        {STUDENT_YEAR_OPTIONS.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </Select>
                      {errors.year ? <p className="mt-1 text-xs text-[#0339A6]">{errors.year}</p> : null}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#26150F]" htmlFor="semester">
                        Semester
                      </label>
                      <Select
                        id="semester"
                        onChange={(event) => setForm((prev) => ({ ...prev, semester: event.target.value }))}
                        value={form.semester}
                      >
                        <option value="">Select Semester</option>
                        {SEMESTER_OPTIONS.map((semester) => (
                          <option key={semester} value={semester}>
                            {semester}
                          </option>
                        ))}
                      </Select>
                      {errors.semester ? <p className="mt-1 text-xs text-[#0339A6]">{errors.semester}</p> : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {isTeachingRole(form.role) ? (
                <div className="space-y-4 rounded-2xl border border-black/10 bg-[#034AA6]/4 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-[#26150F]" htmlFor="teachingFaculty">
                        Faculty
                      </label>
                      <Select
                        id="teachingFaculty"
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            faculty: event.target.value,
                            degreeProgram: "",
                            modules: [],
                          }))
                        }
                        value={form.faculty}
                      >
                        <option value="">Select Faculty</option>
                        {facultyOptions.map((faculty) => (
                          <option key={faculty} value={faculty}>
                            {faculty}
                          </option>
                        ))}
                      </Select>
                      {errors.faculty ? <p className="mt-1 text-xs text-[#0339A6]">{errors.faculty}</p> : null}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#26150F]" htmlFor="teachingProgram">
                        Degree Program
                      </label>
                      <Select
                        id="teachingProgram"
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            degreeProgram: event.target.value,
                            modules: [],
                          }))
                        }
                        value={form.degreeProgram}
                      >
                        <option value="">Select Program</option>
                        {formProgramOptions.map((program) => (
                          <option key={program} value={program}>
                            {program}
                          </option>
                        ))}
                      </Select>
                      {errors.degreeProgram ? <p className="mt-1 text-xs text-[#0339A6]">{errors.degreeProgram}</p> : null}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[#26150F]">Modules</label>
                    {moduleOptions.length === 0 ? (
                      <p className="mt-2 text-sm text-[#26150F]/65">
                        Select a degree program to assign modules.
                      </p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {moduleOptions.map((moduleName) => {
                          const selected = form.modules.includes(moduleName);
                          return (
                            <button
                              className={[
                                "rounded-full border px-3 py-1.5 text-sm transition-colors duration-200",
                                selected
                                  ? "border-[#034AA6]/40 bg-[#034AA6]/12 text-[#034AA6]"
                                  : "border-black/15 bg-white text-[#26150F] hover:border-[#034AA6]/40 hover:text-[#0339A6]",
                              ].join(" ")}
                              key={moduleName}
                              onClick={() => toggleModule(moduleName)}
                              type="button"
                            >
                              {moduleName}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {errors.modules ? <p className="mt-1 text-xs text-[#0339A6]">{errors.modules}</p> : null}
                  </div>
                </div>
              ) : null}

              {form.role === "Lost Item Officer" ? (
                <div className="rounded-2xl border border-black/10 bg-[#034AA6]/4 p-4">
                  <label className="text-sm font-medium text-[#26150F]" htmlFor="officeLocation">
                    Assigned Office/Location
                  </label>
                  <Input
                    id="officeLocation"
                    onChange={(event) => setForm((prev) => ({ ...prev, officeLocation: event.target.value }))}
                    placeholder="e.g., Student Services Counter"
                    value={form.officeLocation}
                  />
                  {errors.officeLocation ? <p className="mt-1 text-xs text-[#0339A6]">{errors.officeLocation}</p> : null}
                </div>
              ) : null}

              {form.role === "Admin" ? (
                <div className="rounded-2xl border border-black/10 bg-[#034AA6]/4 p-4">
                  <p className="text-sm font-medium text-[#26150F]">Permissions</p>
                  <div className="mt-2 space-y-2">
                    {ADMIN_PERMISSIONS.map((permission) => {
                      const selected = form.permissions.includes(permission);
                      return (
                        <label className="flex items-center gap-2 text-sm text-[#26150F]" key={permission}>
                          <input
                            checked={selected}
                            className="h-4 w-4 rounded border-black/20 text-[#034AA6] focus:ring-[#034AA6]/30"
                            onChange={() => togglePermission(permission)}
                            type="checkbox"
                          />
                          {permission}
                        </label>
                      );
                    })}
                  </div>
                  {errors.permissions ? <p className="mt-1 text-xs text-[#0339A6]">{errors.permissions}</p> : null}
                </div>
              ) : null}
            </form>

            <div className="mt-6 flex items-center justify-between gap-3">
              <Button
                className="min-h-10 rounded-xl px-4"
                onClick={closeModal}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
              <Button className="min-h-10 rounded-xl bg-[#034AA6] px-5 text-[#D9D9D9] hover:bg-[#0339A6]" form="user-form" type="submit">
                {modal.mode === "add" ? "Save User" : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

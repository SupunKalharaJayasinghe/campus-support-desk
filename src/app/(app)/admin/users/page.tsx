import Link from "next/link";
import {
  ArrowRight,
  BookUser,
  ShieldCheck,
  UserCog,
  UserSquare2,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import "@/models/LabAssistant";
import "@/models/Lecturer";
import "@/models/Student";
import "@/models/User";
import { LabAssistantModel } from "@/models/LabAssistant";
import { LecturerModel } from "@/models/Lecturer";
import { connectMongoose } from "@/models/mongoose";
import { StudentModel } from "@/models/Student";
import { UserModel } from "@/models/User";

export const dynamic = "force-dynamic";

interface UserDirectoryCard {
  key: string;
  title: string;
  description: string;
  href: string;
  total: number;
  activeLabel: string;
  icon: typeof Users;
}

type SummaryTone = "sky" | "teal" | "amber" | "green" | "rose" | "violet";

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: SummaryTone;
}) {
  return (
    <Card accent className="admin-stat-card h-full p-5" data-tone={tone}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-heading">{value}</p>
        </div>
        <span className="admin-stat-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-current">
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-4 text-xs text-text/60">{detail}</p>
    </Card>
  );
}

async function loadDirectoryCounts() {
  const mongooseConnection = await connectMongoose().catch(() => null);
  if (!mongooseConnection) {
    return null;
  }

  const [
    totalStudents,
    activeStudents,
    totalLecturers,
    activeLecturers,
    totalAssistants,
    activeAssistants,
    totalTechnicians,
    activeTechnicians,
    totalAdmins,
    activeAdmins,
  ] = await Promise.all([
    StudentModel.countDocuments({}).catch(() => 0),
    StudentModel.countDocuments({ status: "ACTIVE" }).catch(() => 0),
    LecturerModel.countDocuments({}).catch(() => 0),
    LecturerModel.countDocuments({ status: "ACTIVE" }).catch(() => 0),
    LabAssistantModel.countDocuments({}).catch(() => 0),
    LabAssistantModel.countDocuments({ status: "ACTIVE" }).catch(() => 0),
    UserModel.countDocuments({ role: { $in: ["TECHNICIAN", "TECHNISIAN"] } }).catch(() => 0),
    UserModel.countDocuments({
      role: { $in: ["TECHNICIAN", "TECHNISIAN"] },
      status: "ACTIVE",
    }).catch(() => 0),
    UserModel.countDocuments({
      role: { $in: ["ADMIN", "COMMUNITY_ADMIN", "LOST_ITEM_ADMIN"] },
    }).catch(() => 0),
    UserModel.countDocuments({
      role: { $in: ["ADMIN", "COMMUNITY_ADMIN", "LOST_ITEM_ADMIN"] },
      status: "ACTIVE",
    }).catch(() => 0),
  ]);

  return {
    cards: [
      {
        key: "students",
        title: "Students",
        description: "Create, update, and review student records and enrollments.",
        href: "/admin/users/students",
        total: totalStudents,
        activeLabel: `${activeStudents.toLocaleString()} active`,
        icon: Users,
      },
      {
        key: "lecturers",
        title: "Lecturers",
        description: "Manage lecturer profiles, faculty mapping, and module assignments.",
        href: "/admin/users/lecturers",
        total: totalLecturers,
        activeLabel: `${activeLecturers.toLocaleString()} active`,
        icon: UserSquare2,
      },
      {
        key: "lab-assistants",
        title: "Lab Assistants",
        description: "Maintain lab support records and linked teaching allocations.",
        href: "/admin/users/lab-assistants",
        total: totalAssistants,
        activeLabel: `${activeAssistants.toLocaleString()} active`,
        icon: UserCog,
      },
      {
        key: "technicians",
        title: "Technicians",
        description: "Manage technician login accounts for support tickets and related workflows.",
        href: "/admin/users/technicians",
        total: totalTechnicians,
        activeLabel: `${activeTechnicians.toLocaleString()} active`,
        icon: Wrench,
      },
      {
        key: "admins",
        title: "Admin Accounts",
        description: "Control admin and community admin access credentials.",
        href: "/admin/users/admins",
        total: totalAdmins,
        activeLabel: `${activeAdmins.toLocaleString()} active`,
        icon: ShieldCheck,
      },
    ] satisfies UserDirectoryCard[],
    totalUsers:
      totalStudents + totalLecturers + totalAssistants + totalTechnicians + totalAdmins,
  };
}

export default async function AdminUsersPage() {
  const directory = await loadDirectoryCounts();
  const summaryCards = directory
    ? [
        {
          label: "Total Users",
          value: directory.totalUsers.toLocaleString(),
          detail: "All visible user records managed through admin user directories.",
          icon: Users,
          tone: "sky" as const,
        },
        {
          label: "Student Records",
          value: directory.cards.find((item) => item.key === "students")?.total.toLocaleString() ?? "0",
          detail: directory.cards.find((item) => item.key === "students")?.activeLabel ?? "0 active",
          icon: BookUser,
          tone: "teal" as const,
        },
        {
          label: "Teaching Staff",
          value: (
            (directory.cards.find((item) => item.key === "lecturers")?.total ?? 0) +
            (directory.cards.find((item) => item.key === "lab-assistants")?.total ?? 0)
          ).toLocaleString(),
          detail: "Combined lecturer and lab assistant records across the LMS.",
          icon: UserSquare2,
          tone: "violet" as const,
        },
        {
          label: "Admin Access",
          value: directory.cards.find((item) => item.key === "admins")?.total.toLocaleString() ?? "0",
          detail: "Main admin and community admin accounts with dashboard access.",
          icon: ShieldCheck,
          tone: "amber" as const,
        },
      ]
    : [];

  return (
    <div className="admin-dashboard space-y-6 lg:space-y-8">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
        <Card accent className="p-6 lg:p-7">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <Badge variant="neutral">User Management</Badge>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-heading">
                  User directory hub
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-text/68">
                  Access the dedicated student, lecturer, lab assistant, technician, and admin
                  directories from one consistent control surface styled to match the
                  updated academic pages.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:items-end">
                <div className="admin-inline-stat rounded-[24px] border border-border bg-card p-4 sm:min-w-[190px]">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                    Directory Scope
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-heading">
                    {directory ? directory.cards.length.toLocaleString() : "0"}
                  </p>
                  <p className="mt-1 text-sm text-text/60">
                    {directory
                      ? "Dedicated user directories available from this section"
                      : "Waiting for directory data"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={directory ? "success" : "neutral"}>
                {directory ? "Live Mongo data" : "Database unavailable"}
              </Badge>
              <Badge variant="neutral">Students, Teaching Staff, Technicians, Admins</Badge>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {summaryCards.map((item) => (
            <SummaryCard
              detail={item.detail}
              icon={item.icon}
              key={item.label}
              label={item.label}
              tone={item.tone}
              value={item.value}
            />
          ))}
        </div>
      </section>

      {directory ? (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-border px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-lg font-semibold text-heading">Available User Directories</p>
              <p className="mt-1 text-sm text-text/68">
                Open the directory you need and manage records with the same updated
                admin layout pattern.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">5 directories</Badge>
              <Badge variant="neutral">
                {directory.totalUsers.toLocaleString()} total user records
              </Badge>
            </div>
          </div>

          <div className="px-4 py-4 sm:px-6 sm:py-6">
            <div className="grid gap-4 xl:grid-cols-2">
              {directory.cards.map((item) => {
                const Icon = item.icon;

                return (
                  <Card accent className="admin-stat-card p-5" data-tone="sky" key={item.key}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                          {item.title}
                        </p>
                        <p className="mt-3 text-3xl font-semibold tracking-tight text-heading">
                          {item.total.toLocaleString()}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-text/68">{item.description}</p>
                      </div>
                      <span className="admin-stat-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-current">
                        <Icon size={18} />
                      </span>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <Badge variant="neutral">{item.activeLabel}</Badge>
                      <Link
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-white/80 px-4 py-2 text-sm font-medium text-heading transition-colors hover:bg-white"
                        href={item.href}
                      >
                        Open directory
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </Card>
      ) : (
        <Card accent className="p-6">
          <div className="flex flex-col gap-3">
            <Badge variant="neutral">Directory Status</Badge>
            <div>
              <p className="text-lg font-semibold text-heading">Database unavailable</p>
              <p className="mt-2 text-sm leading-6 text-text/68">
                The user directory overview requires an active MongoDB connection before
                these counts can be loaded.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

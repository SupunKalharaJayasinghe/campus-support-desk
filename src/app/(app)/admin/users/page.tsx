import Link from "next/link";
import { ArrowRight, ShieldCheck, UserCog, UserSquare2, Users } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
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
    totalAdmins,
    activeAdmins,
  ] = await Promise.all([
    StudentModel.countDocuments({}).catch(() => 0),
    StudentModel.countDocuments({ status: "ACTIVE" }).catch(() => 0),
    LecturerModel.countDocuments({}).catch(() => 0),
    LecturerModel.countDocuments({ status: "ACTIVE" }).catch(() => 0),
    LabAssistantModel.countDocuments({}).catch(() => 0),
    LabAssistantModel.countDocuments({ status: "ACTIVE" }).catch(() => 0),
    UserModel.countDocuments({ role: { $in: ["ADMIN", "LOST_ITEM_ADMIN"] } }).catch(
      () => 0
    ),
    UserModel.countDocuments({
      role: { $in: ["ADMIN", "LOST_ITEM_ADMIN"] },
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
        key: "admins",
        title: "Admin Accounts",
        description: "Control admin and lost-item admin access credentials.",
        href: "/admin/users/admins",
        total: totalAdmins,
        activeLabel: `${activeAdmins.toLocaleString()} active`,
        icon: ShieldCheck,
      },
    ] satisfies UserDirectoryCard[],
    totalUsers: totalStudents + totalLecturers + totalAssistants + totalAdmins,
  };
}

export default async function AdminUsersPage() {
  const directory = await loadDirectoryCounts();

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        description="User management now runs through dedicated database-backed directories for each account type."
        title="Users Management"
      />

      {directory ? (
        <>
          <Card accent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                  Directory Overview
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-heading">
                  {directory.totalUsers.toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-text/68">
                  Total user records reachable through admin user directories.
                </p>
              </div>
              <Badge variant="success">Live Mongo data</Badge>
            </div>
          </Card>

          <section className="grid gap-4 xl:grid-cols-2">
            {directory.cards.map((item) => {
              const Icon = item.icon;
              return (
                <Card accent className="p-5" key={item.key}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
                        {item.title}
                      </p>
                      <p className="mt-3 text-3xl font-semibold tracking-tight text-heading">
                        {item.total.toLocaleString()}
                      </p>
                      <p className="mt-2 text-sm text-text/68">{item.description}</p>
                    </div>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon size={18} />
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <Badge variant="neutral">{item.activeLabel}</Badge>
                    <Link
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primaryHover"
                      href={item.href}
                    >
                      Open
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </Card>
              );
            })}
          </section>
        </>
      ) : (
        <Card className="p-5">
          <p className="text-base font-semibold text-heading">Database unavailable</p>
          <p className="mt-2 text-sm text-text/68">
            The user directory overview requires an active MongoDB connection.
          </p>
        </Card>
      )}
    </div>
  );
}

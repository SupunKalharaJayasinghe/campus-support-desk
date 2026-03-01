"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/ToastProvider";
import { type StudentTrack, useGrouping } from "../GroupingContext";

const PAGE_SIZE = 10;

type TargetTrack = "weekday" | "weekend";

function isTargetTrack(value: string | null): value is TargetTrack {
  return value === "weekday" || value === "weekend";
}

function trackLabel(track: StudentTrack) {
  if (track === "weekday") return "Weekday";
  if (track === "weekend") return "Weekend";
  return "Unassigned";
}

function renderTrackBadge(track: StudentTrack) {
  if (track === "weekday") return <Badge variant="primary">Weekday</Badge>;
  if (track === "weekend") return <Badge variant="neutral">Weekend</Badge>;
  return <Badge variant="neutral">Unassigned</Badge>;
}

function toTargetTrack(value: string | null): TargetTrack {
  return isTargetTrack(value) ? value : "weekday";
}

function AddStudentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { students, faculties, degreePrograms, years, semesters, assignStudentsToTrack } =
    useGrouping();

  const targetTrack = toTargetTrack(searchParams.get("track"));
  const targetTrackLabel = trackLabel(targetTrack);

  const [facultyFilter, setFacultyFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();

    return students.filter((student) => {
      if (facultyFilter !== "all" && student.faculty !== facultyFilter) return false;
      if (programFilter !== "all" && student.degreeProgram !== programFilter) return false;
      if (yearFilter !== "all" && student.year !== Number(yearFilter)) return false;
      if (semesterFilter !== "all" && student.semester !== Number(semesterFilter))
        return false;
      if (!q) return true;

      return (
        student.name.toLowerCase().includes(q) ||
        student.campusId.toLowerCase().includes(q) ||
        student.email.toLowerCase().includes(q)
      );
    });
  }, [facultyFilter, programFilter, search, semesterFilter, students, yearFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const pageRows = filteredStudents.slice(
    (activePage - 1) * PAGE_SIZE,
    activePage * PAGE_SIZE
  );

  const allPageSelected =
    pageRows.length > 0 && pageRows.every((row) => selectedIds.has(row.id));

  const onSelectAllPage = (checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const row of pageRows) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  };

  const onToggleRow = (studentId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const handleAssignSelected = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const updatedCount = assignStudentsToTrack(ids, targetTrack);

    toast({
      title: `Added ${updatedCount} students to ${targetTrackLabel}`,
      message: `Added ${updatedCount} students to ${targetTrackLabel}`,
    });

    router.push(`/admin/groups?tab=${targetTrack}`);
  };

  const handleAssignSingle = (studentId: string, studentName: string) => {
    const updatedCount = assignStudentsToTrack([studentId], targetTrack);
    if (updatedCount === 0) return;

    setSelectedIds((previous) => {
      const next = new Set(previous);
      next.delete(studentId);
      return next;
    });

    toast({
      title: `Added ${studentName} to ${targetTrackLabel}`,
      message: `Added ${studentName} to ${targetTrackLabel}`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#0A0A0A]">
            Add Students to {targetTrackLabel}
          </h1>
          <div className="mt-2">
            <Badge variant="primary">Target Track: {targetTrackLabel}</Badge>
          </div>
        </div>
        <Link href={`/admin/groups?tab=${targetTrack}`}>
          <Button variant="secondary">← Back to Grouping</Button>
        </Link>
      </div>

      <Card className="rounded-3xl border border-[#26150F]/25 bg-white p-6 shadow-[0_8px_24px_rgba(38,21,15,0.08)]">
        <h2 className="text-xl font-semibold text-[#0A0A0A]">Filters</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Select
            onChange={(event) => {
              setFacultyFilter(event.target.value);
              setCurrentPage(1);
            }}
            value={facultyFilter}
          >
            <option value="all">All Faculties</option>
            {faculties.map((faculty) => (
              <option key={faculty} value={faculty}>
                {faculty}
              </option>
            ))}
          </Select>

          <Select
            onChange={(event) => {
              setProgramFilter(event.target.value);
              setCurrentPage(1);
            }}
            value={programFilter}
          >
            <option value="all">All Degree Programs</option>
            {degreePrograms.map((program) => (
              <option key={program} value={program}>
                {program}
              </option>
            ))}
          </Select>

          <Select
            onChange={(event) => {
              setYearFilter(event.target.value);
              setCurrentPage(1);
            }}
            value={yearFilter}
          >
            <option value="all">All Years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                Year {year}
              </option>
            ))}
          </Select>

          <Select
            onChange={(event) => {
              setSemesterFilter(event.target.value);
              setCurrentPage(1);
            }}
            value={semesterFilter}
          >
            <option value="all">All Semesters</option>
            {semesters.map((semester) => (
              <option key={semester} value={semester}>
                Semester {semester}
              </option>
            ))}
          </Select>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#26150F]/55"
              size={15}
            />
            <Input
              className="pl-9"
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search student..."
              value={search}
            />
          </div>
        </div>
      </Card>

      <Card className="rounded-3xl border border-[#26150F]/25 bg-white p-6 shadow-[0_8px_24px_rgba(38,21,15,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-[#0A0A0A]">Students</h2>
          <Button
            className="bg-[#034AA6] text-white hover:bg-[#0339A6]"
            disabled={selectedIds.size === 0}
            onClick={handleAssignSelected}
          >
            Add Selected
          </Button>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-[#26150F]/15">
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#26150F]/4 text-[#26150F]/78">
                  <th className="sticky top-0 z-10 w-10 bg-[#F7F6F6] px-3 py-3 text-left">
                    <input
                      aria-label="Select all students on page"
                      checked={allPageSelected}
                      onChange={(event) => onSelectAllPage(event.target.checked)}
                      type="checkbox"
                    />
                  </th>
                  <th className="sticky top-0 z-10 bg-[#F7F6F6] px-3 py-3 text-left">Student Name</th>
                  <th className="sticky top-0 z-10 bg-[#F7F6F6] px-3 py-3 text-left">Campus ID</th>
                  <th className="sticky top-0 z-10 bg-[#F7F6F6] px-3 py-3 text-left">Email</th>
                  <th className="sticky top-0 z-10 bg-[#F7F6F6] px-3 py-3 text-left">Faculty</th>
                  <th className="sticky top-0 z-10 bg-[#F7F6F6] px-3 py-3 text-left">Degree Program</th>
                  <th className="sticky top-0 z-10 bg-[#F7F6F6] px-3 py-3 text-left">Year</th>
                  <th className="sticky top-0 z-10 bg-[#F7F6F6] px-3 py-3 text-left">Semester</th>
                  <th className="sticky top-0 z-10 bg-[#F7F6F6] px-3 py-3 text-left">Current Track</th>
                  <th className="sticky top-0 z-10 bg-[#F7F6F6] px-3 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((student) => (
                  <tr className="border-t border-[#26150F]/10" key={student.id}>
                    <td className="px-3 py-3 align-top">
                      <input
                        aria-label={`Select ${student.name}`}
                        checked={selectedIds.has(student.id)}
                        onChange={() => onToggleRow(student.id)}
                        type="checkbox"
                      />
                    </td>
                    <td className="px-3 py-3 font-medium text-[#0A0A0A]">{student.name}</td>
                    <td className="px-3 py-3 text-[#26150F]/80">{student.campusId}</td>
                    <td className="px-3 py-3 text-[#26150F]/80">{student.email}</td>
                    <td className="px-3 py-3 text-[#26150F]/80">{student.faculty}</td>
                    <td className="px-3 py-3 text-[#26150F]/80">{student.degreeProgram}</td>
                    <td className="px-3 py-3 text-[#26150F]/80">{student.year}</td>
                    <td className="px-3 py-3 text-[#26150F]/80">{student.semester}</td>
                    <td className="px-3 py-3">{renderTrackBadge(student.track)}</td>
                    <td className="px-3 py-3">
                      <Button
                        className="px-3 py-1.5 text-xs"
                        disabled={student.track === targetTrack}
                        onClick={() => handleAssignSingle(student.id, student.name)}
                      >
                        {student.track === targetTrack ? "Added" : "Add"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredStudents.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[#26150F]/72">
                No results found for the selected filters.
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#26150F]/65">
            Showing {pageRows.length} of {filteredStudents.length} students
          </p>
          <div className="flex items-center gap-2">
            <Button
              disabled={activePage <= 1}
              onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
              variant="secondary"
            >
              Previous
            </Button>
            <span className="text-sm text-[#26150F]/75">
              Page {activePage} / {totalPages}
            </span>
            <Button
              disabled={activePage >= totalPages}
              onClick={() =>
                setCurrentPage((previous) => Math.min(totalPages, previous + 1))
              }
              variant="secondary"
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function AddStudentsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#26150F]/72">Loading students...</div>}>
      <AddStudentsContent />
    </Suspense>
  );
}

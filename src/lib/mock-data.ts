import { Assessment, Module, Program, User, NotificationItem, LostItem } from "@/types";

export const mockUsers: User[] = [
  {
    id: "U-1001",
    name: "Ariana Silva",
    email: "ariana.silva@campus.edu",
    role: "Student",
    status: "Active"
  },
  {
    id: "U-1002",
    name: "Marcus Lee",
    email: "marcus.lee@campus.edu",
    role: "Lecturer",
    status: "Active"
  },
  {
    id: "U-1003",
    name: "Nadine Okafor",
    email: "nadine.okafor@campus.edu",
    role: "Department Admin",
    status: "Active"
  }
];

export const mockPrograms: Program[] = [
  {
    id: "P-01",
    name: "BSc Computer Science",
    code: "CS",
    category: "Computing",
    duration: 4,
    students: 420,
    lecturers: 24,
    status: "Active"
  },
  {
    id: "P-02",
    name: "BSc Information Systems",
    code: "IS",
    category: "Computing",
    duration: 4,
    students: 300,
    lecturers: 18,
    status: "Active"
  },
  {
    id: "P-03",
    name: "BSc Software Engineering",
    code: "SE",
    category: "Engineering",
    duration: 4,
    students: 260,
    lecturers: 14,
    status: "Inactive"
  }
];

export const mockModules: Module[] = [
  {
    id: "M-201",
    name: "Data Structures",
    code: "CS204",
    credits: 4,
    year: 2,
    semester: 1,
    status: "Active"
  },
  {
    id: "M-310",
    name: "Database Systems",
    code: "CS310",
    credits: 3,
    year: 3,
    semester: 1,
    status: "Active"
  },
  {
    id: "M-401",
    name: "Cloud Computing",
    code: "CS401",
    credits: 3,
    year: 4,
    semester: 2,
    status: "Draft"
  }
];

export const mockAssessments: Assessment[] = [
  {
    id: "A-101",
    title: "Mid Exam",
    type: "Mid Exam",
    format: "MCQ Quiz",
    maxMarks: 60,
    status: "Scheduled",
    dueDate: "2026-03-12"
  },
  {
    id: "A-102",
    title: "Lab Test 2",
    type: "Lab Test",
    format: "File Upload",
    maxMarks: 40,
    status: "Open",
    dueDate: "2026-02-28"
  }
];

export const mockNotifications: NotificationItem[] = [
  {
    id: "N-1",
    title: "Exam timetable updated",
    message: "The mid semester exam schedule has been updated.",
    type: "Exam",
    createdAt: "2026-02-16T10:30:00Z",
    read: false
  },
  {
    id: "N-2",
    title: "New assignment posted",
    message: "Assignment 2 is now available in the module page.",
    type: "Assignment",
    createdAt: "2026-02-15T08:00:00Z",
    read: true
  }
];

export const mockLostItems: LostItem[] = [
  {
    id: "L-01",
    title: "Black USB-C Charger",
    category: "Electronics",
    status: "Pending",
    location: "Engineering Block A",
    date: "2026-02-14",
    reporter: "Samira Khan"
  },
  {
    id: "L-02",
    title: "Blue Backpack",
    category: "Bags",
    status: "Approved",
    location: "Library",
    date: "2026-02-12",
    reporter: "Noah Kim"
  }
];

export const mockStats = [
  { title: "Total Students", value: "4,280", change: "+5.4%" },
  { title: "Active Modules", value: "180", change: "+2.1%" },
  { title: "Pending Lost Items", value: "14", change: "-8%" },
  { title: "Unread Notifications", value: "22", change: "+12%" }
];

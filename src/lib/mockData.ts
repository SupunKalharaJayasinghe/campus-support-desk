import type { AppRole, DemoUser } from "@/lib/rbac";

export type NotificationType = "Announcement" | "System";
export type BookingStatus = "Pending" | "Approved" | "Declined" | "Completed";
export type PostStatus = "Draft" | "Open" | "Resolved" | "Archived";
export type PostCategory = "Academic Question" | "Study Material" | "Lost Item";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  unread: boolean;
}

export interface StudentBooking {
  id: string;
  lecturer: string;
  purpose: string;
  date: string;
  time: string;
  status: BookingStatus;
}

export interface LecturerSlot {
  id: string;
  date: string;
  start: string;
  end: string;
}

export interface LecturerBookingRequest {
  id: string;
  studentName: string;
  topic: string;
  date: string;
  start: string;
  end: string;
  status: BookingStatus;
}

export interface PostReply {
  id: string;
  author: string;
  authorId: string;
  message: string;
  time: string;
}

export interface PostItem {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  content: string;
  author: string;
  category: PostCategory;
  tags: string[];
  replies: PostReply[];
  upvotes: number;
  status: PostStatus;
  acceptedReplyId?: string;
  time: string;
  attachmentName?: string;
}

export interface LostItemReport {
  id: string;
  item: string;
  location: string;
  reporter: string;
  date: string;
  status: "Pending Review" | "Verified" | "Claimed";
}

export interface FoundItemRecord {
  id: string;
  item: string;
  location: string;
  recordedBy: string;
  date: string;
  status: "Stored" | "Returned";
}

export interface AdminMetric {
  id: string;
  label: string;
  value: string;
  trend: string;
}

export interface ModerationReport {
  id: string;
  target: string;
  reason: string;
  submittedBy: string;
  status: "Open" | "Under Review" | "Resolved";
}

export interface ModuleNode {
  id: string;
  degree: string;
  module: string;
  batch: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  time: string;
}

export interface LeaderboardItem {
  id: string;
  name: string;
  points: number;
  level: "Beginner" | "Contributor" | "Expert" | "Champion";
}

export interface StudentProfile {
  points: number;
  level: "Beginner" | "Contributor" | "Expert" | "Champion";
  nextLevelPoints: number;
  trophies: string[];
}

export const demoUsers: DemoUser[] = [
  { id: "u-super", name: "Rhea Admin", role: "SUPER_ADMIN" },
  { id: "u-lecturer", name: "Dr. Liam Harper", role: "LECTURER" },
  { id: "u-lost", name: "Nora Perera", role: "LOST_ITEM_STAFF" },
  { id: "u-student", name: "Maya Rodrigo", role: "STUDENT" },
];

export const notificationsByRole: Record<AppRole, NotificationItem[]> = {
  STUDENT: [
    {
      id: "n-s-1",
      type: "Announcement",
      title: "Algorithms assignment closes tomorrow",
      message: "Submit before 11:59 PM to avoid late penalties.",
      time: "12m ago",
      unread: true,
    },
    {
      id: "n-s-2",
      type: "System",
      title: "Booking reminder",
      message: "You have a mentoring session on Friday at 10:30 AM.",
      time: "2h ago",
      unread: true,
    },
    {
      id: "n-s-3",
      type: "Announcement",
      title: "Library weekend hours extended",
      message: "Open until midnight across exam week.",
      time: "1d ago",
      unread: false,
    },
  ],
  LECTURER: [
    {
      id: "n-l-1",
      type: "System",
      title: "New booking requests",
      message: "Four students requested consultation slots.",
      time: "25m ago",
      unread: true,
    },
    {
      id: "n-l-2",
      type: "Announcement",
      title: "Grade release window",
      message: "Publish CA2 grades by Friday 5:00 PM.",
      time: "3h ago",
      unread: true,
    },
    {
      id: "n-l-3",
      type: "System",
      title: "Room update",
      message: "Thursday lecture moved to Hall C-03.",
      time: "1d ago",
      unread: false,
    },
  ],
  LOST_ITEM_STAFF: [
    {
      id: "n-f-1",
      type: "System",
      title: "Queue spike detected",
      message: "Six new reports were filed after 4 PM.",
      time: "18m ago",
      unread: true,
    },
    {
      id: "n-f-2",
      type: "Announcement",
      title: "Claim verification update",
      message: "Enable student ID + contact check for high-value items.",
      time: "4h ago",
      unread: true,
    },
    {
      id: "n-f-3",
      type: "System",
      title: "Locker inventory sync complete",
      message: "Storage cabinet audit has been completed.",
      time: "1d ago",
      unread: false,
    },
  ],
  SUPER_ADMIN: [
    {
      id: "n-a-1",
      type: "System",
      title: "Moderation queue requires review",
      message: "Five unresolved reports remain open.",
      time: "14m ago",
      unread: true,
    },
    {
      id: "n-a-2",
      type: "Announcement",
      title: "Semester rollout checklist",
      message: "Confirm user imports and module mapping by Monday.",
      time: "2h ago",
      unread: true,
    },
    {
      id: "n-a-3",
      type: "System",
      title: "Platform health steady",
      message: "No major API error spikes in the last 24h.",
      time: "1d ago",
      unread: false,
    },
  ],
  COMMUNITY_ADMIN: [
    {
      id: "n-c-1",
      type: "System",
      title: "Community highlights",
      message: "Review trending posts and reported content.",
      time: "30m ago",
      unread: true,
    },
    {
      id: "n-c-2",
      type: "Announcement",
      title: "Moderation guidelines",
      message: "Updated policy reference is available in the admin wiki.",
      time: "5h ago",
      unread: false,
    },
  ],
};

export const studentSummary = {
  notifications: 8,
  bookings: 3,
  posts: 5,
  points: 246,
};

export const studentBookings: StudentBooking[] = [
  {
    id: "sb1",
    lecturer: "Dr. Liam Harper",
    purpose: "Project guidance",
    date: "Mar 03, 2026",
    time: "10:30 AM",
    status: "Approved",
  },
  {
    id: "sb2",
    lecturer: "Prof. Niroshan Silva",
    purpose: "Exam revision",
    date: "Mar 05, 2026",
    time: "1:00 PM",
    status: "Pending",
  },
  {
    id: "sb3",
    lecturer: "Dr. Hanif Karim",
    purpose: "Lab feedback",
    date: "Feb 24, 2026",
    time: "9:00 AM",
    status: "Completed",
  },
];

export const availableLecturerSlots = [
  {
    id: "av1",
    lecturer: "Dr. Liam Harper",
    department: "Computer Science",
    slots: [
      { id: "s1", date: "Feb 27, 2026", start: "10:00", end: "10:30" },
      { id: "s2", date: "Feb 28, 2026", start: "11:30", end: "12:00" },
      { id: "s3", date: "Mar 02, 2026", start: "09:00", end: "09:30" },
    ],
  },
  {
    id: "av2",
    lecturer: "Prof. Niroshan Silva",
    department: "Software Engineering",
    slots: [
      { id: "s4", date: "Feb 27, 2026", start: "14:00", end: "14:30" },
      { id: "s5", date: "Mar 01, 2026", start: "15:00", end: "15:30" },
      { id: "s6", date: "Mar 03, 2026", start: "08:30", end: "09:00" },
    ],
  },
];

export const studentPosts: PostItem[] = [
  {
    id: "sp1",
    ownerId: "u-student",
    title: "Best revision path for Algorithms midterm?",
    description: "Need a realistic one-week plan focused on DP and graph questions.",
    content:
      "I have one week before the midterm and want a practical plan for dynamic programming and graph-based questions. Please share approaches that worked for you.",
    author: "Maya Rodrigo",
    category: "Academic Question",
    tags: ["algorithms", "midterm", "revision"],
    replies: [
      {
        id: "spr1",
        author: "Dr. Liam Harper",
        authorId: "u-lecturer",
        message: "Start with recurrence patterns, then solve one graph shortest path set daily.",
        time: "30m ago",
      },
      {
        id: "spr2",
        author: "Ava Martin",
        authorId: "u-student-2",
        message: "Past papers helped most for timing. Keep a 12-minute question cap.",
        time: "12m ago",
      },
    ],
    upvotes: 19,
    status: "Open",
    time: "45m ago",
  },
  {
    id: "sp2",
    ownerId: "u-student",
    title: "OS cheat sheet draft",
    description: "Compiling scheduling formulas and sample calculations.",
    content:
      "Working on a small reference sheet for FCFS, SJF, and RR examples. Sharing draft before final upload.",
    author: "Maya Rodrigo",
    category: "Study Material",
    tags: ["os", "lab", "notes"],
    replies: [],
    upvotes: 7,
    status: "Draft",
    time: "3h ago",
    attachmentName: "os-cheatsheet-draft.pdf",
  },
  {
    id: "sp3",
    ownerId: "u-student-4",
    title: "Lost calculator near Engineering Block",
    description: "Black Casio scientific calculator with name sticker.",
    content:
      "I misplaced my black Casio calculator near the Engineering Block study area around 5 PM.",
    author: "Nina Peris",
    category: "Lost Item",
    tags: ["lost-and-found", "engineering", "calculator"],
    replies: [
      {
        id: "spr3",
        author: "Lost & Found Desk",
        authorId: "u-lost",
        message: "A matching item is in queue verification. Please bring student ID.",
        time: "1h ago",
      },
    ],
    upvotes: 3,
    status: "Archived",
    time: "1d ago",
  },
];

export const studentProfile: StudentProfile = {
  points: 246,
  level: "Contributor",
  nextLevelPoints: 400,
  trophies: ["Quiz Sprinter", "Forum Helper", "Week Streak"],
};

export const studentLeaderboard: LeaderboardItem[] = [
  { id: "lb1", name: "Maya Rodrigo", points: 246, level: "Contributor" },
  { id: "lb2", name: "Ava Martin", points: 234, level: "Contributor" },
  { id: "lb3", name: "Noah Perera", points: 220, level: "Contributor" },
  { id: "lb4", name: "Isha Fernando", points: 182, level: "Beginner" },
  { id: "lb5", name: "Luka Dias", points: 174, level: "Beginner" },
];

export const studentActivity: ActivityItem[] = [
  { id: "sa1", action: "Completed CS204 quiz on time (+35 XP)", time: "1h ago" },
  { id: "sa2", action: "Scored above 80% in Data Structures (+20 XP)", time: "4h ago" },
  { id: "sa3", action: "Received accepted answer on post (+15 XP)", time: "1d ago" },
  { id: "sa4", action: "Maintained 5-day login streak (+10 XP)", time: "1d ago" },
  { id: "sa5", action: "Uploaded study material (+12 XP)", time: "2d ago" },
];

export const lecturerAvailabilitySeed: LecturerSlot[] = [
  { id: "la1", date: "2026-02-27", start: "09:00", end: "10:00" },
  { id: "la2", date: "2026-02-28", start: "13:00", end: "14:00" },
  { id: "la3", date: "2026-03-02", start: "11:30", end: "12:30" },
];

export const lecturerBookingRequests: LecturerBookingRequest[] = [
  {
    id: "lr1",
    studentName: "Maya Rodrigo",
    topic: "Project review",
    date: "2026-02-27",
    start: "09:00",
    end: "09:30",
    status: "Pending",
  },
  {
    id: "lr2",
    studentName: "Ava Martin",
    topic: "Assessment clarification",
    date: "2026-02-28",
    start: "13:00",
    end: "13:30",
    status: "Pending",
  },
  {
    id: "lr3",
    studentName: "Noah Perera",
    topic: "Career advice",
    date: "2026-03-02",
    start: "11:30",
    end: "12:00",
    status: "Approved",
  },
];

export const lecturerPosts: PostItem[] = [
  {
    id: "lp1",
    ownerId: "u-student-8",
    title: "Need help understanding normalization",
    description: "Struggling with 2NF and 3NF examples.",
    content:
      "I understand basic dependencies but get confused when decomposing into 3NF. Any step-by-step method?",
    author: "Ruvin Silva",
    category: "Academic Question",
    tags: ["database", "normalization"],
    replies: [
      {
        id: "lpr1",
        author: "Dr. Liam Harper",
        authorId: "u-lecturer",
        message: "Start with candidate keys first, then remove partial dependencies.",
        time: "20m ago",
      },
    ],
    upvotes: 12,
    status: "Open",
    time: "1h ago",
  },
  {
    id: "lp2",
    ownerId: "u-student-9",
    title: "Lecture note request for week 5",
    description: "Missed class due to illness.",
    content:
      "Could someone share week 5 notes? I missed class because of a medical appointment.",
    author: "Sachi Perera",
    category: "Study Material",
    tags: ["notes", "week5"],
    replies: [],
    upvotes: 5,
    status: "Open",
    time: "3h ago",
  },
];

export const lostItemReports: LostItemReport[] = [
  {
    id: "li1",
    item: "Black backpack",
    location: "Library West",
    reporter: "Nina Peris",
    date: "Feb 26, 2026",
    status: "Pending Review",
  },
  {
    id: "li2",
    item: "Blue water bottle",
    location: "Gym foyer",
    reporter: "Kavindu Sen",
    date: "Feb 26, 2026",
    status: "Verified",
  },
  {
    id: "li3",
    item: "Student ID card",
    location: "North Gate",
    reporter: "Security Desk",
    date: "Feb 25, 2026",
    status: "Claimed",
  },
];

export const foundItemsSeed: FoundItemRecord[] = [
  {
    id: "fi1",
    item: "Silver calculator",
    location: "Engineering Block",
    recordedBy: "Nora Perera",
    date: "Feb 26, 2026",
    status: "Stored",
  },
  {
    id: "fi2",
    item: "Blue notebook",
    location: "Auditorium C",
    recordedBy: "Nora Perera",
    date: "Feb 25, 2026",
    status: "Returned",
  },
];

export const lostItemLocations = [
  { location: "Library West", count: 12 },
  { location: "Engineering Block", count: 8 },
  { location: "Main Canteen", count: 6 },
  { location: "Sports Complex", count: 4 },
];

export const adminUsersSeed: DemoUser[] = [
  { id: "u-super", name: "Rhea Admin", role: "SUPER_ADMIN" },
  { id: "u-lecturer", name: "Dr. Liam Harper", role: "LECTURER" },
  { id: "u-lost", name: "Nora Perera", role: "LOST_ITEM_STAFF" },
  { id: "u-student", name: "Maya Rodrigo", role: "STUDENT" },
  { id: "u-student-2", name: "Ava Martin", role: "STUDENT" },
];

export const adminModulesSeed: ModuleNode[] = [
  { id: "m1", degree: "BSc Computer Science", module: "CS204 - Algorithms", batch: "2024" },
  { id: "m2", degree: "BSc Computer Science", module: "CS221 - Databases", batch: "2023" },
  { id: "m3", degree: "BSc IT", module: "IT305 - Web Engineering", batch: "2024" },
];

export const moderationReportsSeed: ModerationReport[] = [
  {
    id: "mr1",
    target: "Post #sp1",
    reason: "Off-topic replies",
    submittedBy: "Ava Martin",
    status: "Open",
  },
  {
    id: "mr2",
    target: "Comment #c103",
    reason: "Spam links",
    submittedBy: "Nina Peris",
    status: "Under Review",
  },
  {
    id: "mr3",
    target: "Post #lp2",
    reason: "Duplicate content",
    submittedBy: "System",
    status: "Resolved",
  },
];

export const adminMetrics: AdminMetric[] = [
  { id: "am1", label: "Active Users", value: "2,148", trend: "+4.5%" },
  { id: "am2", label: "Open Support Tickets", value: "73", trend: "-8.2%" },
  { id: "am3", label: "Pending Moderation", value: "19", trend: "+2.1%" },
  { id: "am4", label: "Lost Item Resolution", value: "82%", trend: "+6.0%" },
];

export const platformKpis = [
  { id: "k1", label: "Daily Logins", value: "1,324" },
  { id: "k2", label: "Avg Response Time", value: "2h 18m" },
  { id: "k3", label: "Bookings Completed", value: "94" },
  { id: "k4", label: "Announcements Sent", value: "17" },
];

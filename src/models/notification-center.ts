import type { AppRole, DemoUser } from "@/models/rbac";

export type NotificationFeedType = "Announcement" | "System";
export type SemesterCode =
  | "Y1S1"
  | "Y1S2"
  | "Y2S1"
  | "Y2S2"
  | "Y3S1"
  | "Y3S2"
  | "Y4S1"
  | "Y4S2";
export type StreamCode = "WEEKDAY" | "WEEKEND";

interface NotificationAudience {
  roles: AppRole[];
  facultyCodes?: string[];
  degreeCodes?: string[];
  semesterCodes?: SemesterCode[];
  streamCodes?: StreamCode[];
  subgroupCodes?: string[];
}

export interface NotificationFeedItem {
  id: string;
  type: NotificationFeedType;
  title: string;
  message: string;
  time: string;
  publishedAt: string;
  unread: boolean;
  targetLabel: string;
  audience: NotificationAudience;
}

export interface NotificationViewer {
  role: AppRole;
  facultyCodes?: string[];
  degreeProgramIds?: string[];
  semesterCode?: string;
  stream?: string;
  subgroup?: string | null;
}

const NOTIFICATION_FEED: NotificationFeedItem[] = [
  {
    id: "feed-001",
    type: "Announcement",
    title: "FOC Y1S1 Orientation Timetable Published",
    message: "Faculty of Computing Y1S1 orientation schedule is now available.",
    time: "12m ago",
    publishedAt: "2026-03-27T08:30:00.000Z",
    unread: true,
    targetLabel: "STUDENT / FOC / Y1S1 / All Intakes",
    audience: {
      roles: ["STUDENT"],
      facultyCodes: ["FOC"],
      semesterCodes: ["Y1S1"],
    },
  },
  {
    id: "feed-002",
    type: "Announcement",
    title: "FOE Lab Safety Briefing",
    message: "Engineering students must complete the updated lab safety briefing.",
    time: "30m ago",
    publishedAt: "2026-03-27T07:55:00.000Z",
    unread: true,
    targetLabel: "STUDENT / FOE / Y1S1",
    audience: {
      roles: ["STUDENT"],
      facultyCodes: ["FOE"],
      semesterCodes: ["Y1S1"],
    },
  },
  {
    id: "feed-003",
    type: "System",
    title: "Student Portal Maintenance Notice",
    message: "Portal services may be briefly unavailable from 11:30 PM to 11:45 PM.",
    time: "1h ago",
    publishedAt: "2026-03-27T07:10:00.000Z",
    unread: true,
    targetLabel: "All Students",
    audience: {
      roles: ["STUDENT"],
    },
  },
  {
    id: "feed-004",
    type: "Announcement",
    title: "SE Degree Assignment Deadline Reminder",
    message: "SE coursework deadlines close in 48 hours. Review your submission checklist.",
    time: "2h ago",
    publishedAt: "2026-03-27T06:20:00.000Z",
    unread: true,
    targetLabel: "STUDENT / SE",
    audience: {
      roles: ["STUDENT"],
      degreeCodes: ["SE"],
    },
  },
  {
    id: "feed-005",
    type: "Announcement",
    title: "Weekend Stream Session Update",
    message: "Weekend stream supplementary session moved to Saturday 2 PM.",
    time: "3h ago",
    publishedAt: "2026-03-27T05:30:00.000Z",
    unread: true,
    targetLabel: "STUDENT / WEEKEND",
    audience: {
      roles: ["STUDENT"],
      streamCodes: ["WEEKEND"],
    },
  },
  {
    id: "feed-006",
    type: "System",
    title: "Lecturer Booking Queue Updated",
    message: "Four new student consultations are pending response.",
    time: "20m ago",
    publishedAt: "2026-03-27T08:12:00.000Z",
    unread: true,
    targetLabel: "LECTURER",
    audience: {
      roles: ["LECTURER"],
    },
  },
  {
    id: "feed-007",
    type: "Announcement",
    title: "FOC Lecturer Moderation Window",
    message: "FOC moderation and grading window closes Friday at 5 PM.",
    time: "1h ago",
    publishedAt: "2026-03-27T07:05:00.000Z",
    unread: true,
    targetLabel: "LECTURER / FOC",
    audience: {
      roles: ["LECTURER"],
      facultyCodes: ["FOC"],
    },
  },
  {
    id: "feed-008",
    type: "System",
    title: "Lost & Found Queue Spike",
    message: "Six new reports were submitted after 4 PM and need review.",
    time: "15m ago",
    publishedAt: "2026-03-27T08:18:00.000Z",
    unread: true,
    targetLabel: "LOST_ITEM_STAFF",
    audience: {
      roles: ["LOST_ITEM_STAFF"],
    },
  },
  {
    id: "feed-009",
    type: "Announcement",
    title: "High Value Claim Verification Update",
    message: "Enable NIC plus contact verification for high-value item claims.",
    time: "2h ago",
    publishedAt: "2026-03-27T06:35:00.000Z",
    unread: true,
    targetLabel: "LOST_ITEM_STAFF",
    audience: {
      roles: ["LOST_ITEM_STAFF"],
    },
  },
  {
    id: "feed-010",
    type: "System",
    title: "Admin Moderation Queue Requires Review",
    message: "Five unresolved moderation reports remain open.",
    time: "9m ago",
    publishedAt: "2026-03-27T08:40:00.000Z",
    unread: true,
    targetLabel: "SUPER_ADMIN",
    audience: {
      roles: ["SUPER_ADMIN"],
    },
  },
  {
    id: "feed-011",
    type: "Announcement",
    title: "Platform-Wide Security Advisory",
    message: "Password reset policy has been updated across all user workspaces.",
    time: "4h ago",
    publishedAt: "2026-03-27T04:22:00.000Z",
    unread: false,
    targetLabel: "All Roles",
    audience: {
      roles: ["SUPER_ADMIN", "LECTURER", "LOST_ITEM_STAFF", "STUDENT"],
    },
  },
];

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function matchCodeList(left: string[], right: string[]) {
  const rightSet = new Set(right.map((value) => normalizeCode(value)));
  return left.some((value) => rightSet.has(normalizeCode(value)));
}

function matchesAudience(
  item: NotificationFeedItem,
  viewer: NotificationViewer
) {
  if (!item.audience.roles.includes(viewer.role)) {
    return false;
  }

  if (item.audience.facultyCodes?.length) {
    if (!viewer.facultyCodes?.length) {
      return false;
    }
    if (!matchCodeList(viewer.facultyCodes, item.audience.facultyCodes)) {
      return false;
    }
  }

  if (item.audience.degreeCodes?.length) {
    if (!viewer.degreeProgramIds?.length) {
      return false;
    }
    if (!matchCodeList(viewer.degreeProgramIds, item.audience.degreeCodes)) {
      return false;
    }
  }

  if (item.audience.semesterCodes?.length) {
    const viewerSemester = String(viewer.semesterCode ?? "")
      .trim()
      .toUpperCase();
    if (!viewerSemester) {
      return false;
    }
    if (!item.audience.semesterCodes.includes(viewerSemester as SemesterCode)) {
      return false;
    }
  }

  if (item.audience.streamCodes?.length) {
    const viewerStream = String(viewer.stream ?? "")
      .trim()
      .toUpperCase();
    if (!viewerStream) {
      return false;
    }
    if (!item.audience.streamCodes.includes(viewerStream as StreamCode)) {
      return false;
    }
  }

  if (item.audience.subgroupCodes?.length) {
    const viewerSubgroup = String(viewer.subgroup ?? "").trim();
    if (!viewerSubgroup) {
      return false;
    }
    if (!item.audience.subgroupCodes.includes(viewerSubgroup)) {
      return false;
    }
  }

  return true;
}

function toViewerFromUser(user: DemoUser, fallbackRole?: AppRole): NotificationViewer {
  return {
    role: user.role || fallbackRole || "STUDENT",
    facultyCodes: user.facultyCodes ?? [],
    degreeProgramIds: user.degreeProgramIds ?? [],
    semesterCode: user.semesterCode,
    stream: user.stream,
    subgroup: user.subgroup,
  };
}

export function resolveNotificationsForViewer(viewer: NotificationViewer) {
  return NOTIFICATION_FEED.filter((item) => matchesAudience(item, viewer)).sort((left, right) =>
    right.publishedAt.localeCompare(left.publishedAt)
  );
}

export function resolveNotificationsForUser(
  user: DemoUser | null,
  fallbackRole: AppRole
) {
  if (!user) {
    return resolveNotificationsForViewer({ role: fallbackRole });
  }

  return resolveNotificationsForViewer(toViewerFromUser(user, fallbackRole));
}

export function resolveNotificationsForRole(role: AppRole) {
  return resolveNotificationsForViewer({ role });
}

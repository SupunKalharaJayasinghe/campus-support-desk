export type BookingStatus = "Pending" | "Approved" | "Declined" | "Completed";
export type PostStatus = "Draft" | "Open" | "Resolved" | "Archived";
export type PostCategory = "Academic Question" | "Study Material" | "Lost Item";

export interface ConsultationBooking {
  id: string;
  studentUserId: string;
  studentName: string;
  lecturerUserId?: string;
  lecturer: string;
  department?: string;
  topic: string;
  date: string;
  start: string;
  end: string;
  status: BookingStatus;
}

export interface LecturerAvailabilitySlot {
  id: string;
  lecturerUserId: string;
  lecturer: string;
  department: string;
  date: string;
  start: string;
  end: string;
}

export interface AvailableLecturerSlotsGroup {
  id: string;
  lecturer: string;
  department: string;
  slots: Array<{
    id: string;
    date: string;
    start: string;
    end: string;
  }>;
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

export interface PlatformKpi {
  id: string;
  label: string;
  value: string;
}

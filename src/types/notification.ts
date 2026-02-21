export type NotificationType =
  | "General"
  | "Academic"
  | "Exam"
  | "Assignment"
  | "Quiz"
  | "Urgent";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: string;
  read: boolean;
};

export type LostItemStatus =
  | "Pending"
  | "Approved"
  | "Claimed"
  | "Returned"
  | "Rejected";

export type LostItem = {
  id: string;
  title: string;
  category: string;
  status: LostItemStatus;
  location: string;
  date: string;
  reporter: string;
};

export type AdminTicketsBadgeVariant =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "primary"
  | "info";

export type AdminTicketsStatusConfig = {
  /** Passed to `?status=` (must match API / DB enum). */
  apiStatus: string;
  /** When true, lists an "Assign technician" action on each row (open tickets). */
  showAssignTechnician?: boolean;
  pageTitle: string;
  pageDescription: string;
  cardTitle: string;
  cardDescription: string;
  statusBadgeLabel: string;
  badgeVariant: AdminTicketsBadgeVariant;
  emptyMessage: string;
  loadingMessage: string;
};

export const ADMIN_TICKETS_OPEN: AdminTicketsStatusConfig = {
  apiStatus: "Open",
  showAssignTechnician: true,
  pageTitle: "Open support tickets",
  pageDescription:
    "Support requests that are still in the Open state and awaiting triage or assignment.",
  cardTitle: "Open tickets",
  cardDescription: "Status: Open",
  statusBadgeLabel: "Open",
  badgeVariant: "info",
  emptyMessage: "No open support tickets right now.",
  loadingMessage: "Loading open tickets…",
};

export const ADMIN_TICKETS_IN_PROGRESS: AdminTicketsStatusConfig = {
  apiStatus: "In progress",
  pageTitle: "In progress support tickets",
  pageDescription:
    "Tickets currently being worked on by staff (status In progress).",
  cardTitle: "In progress tickets",
  cardDescription: "Status: In progress",
  statusBadgeLabel: "In progress",
  badgeVariant: "warning",
  emptyMessage: "No in-progress support tickets right now.",
  loadingMessage: "Loading in-progress tickets…",
};

export const ADMIN_TICKETS_RESOLVED: AdminTicketsStatusConfig = {
  apiStatus: "Resolved",
  pageTitle: "Resolved support tickets",
  pageDescription: "Tickets that have been marked as resolved.",
  cardTitle: "Resolved tickets",
  cardDescription: "Status: Resolved",
  statusBadgeLabel: "Resolved",
  badgeVariant: "success",
  emptyMessage: "No resolved support tickets to show yet.",
  loadingMessage: "Loading resolved tickets…",
};

export const ADMIN_TICKETS_WITHDRAWN: AdminTicketsStatusConfig = {
  apiStatus: "Withdrawn",
  pageTitle: "Withdrawn support tickets",
  pageDescription:
    "Tickets the student or admin withdrew before completion (status Withdrawn).",
  cardTitle: "Withdrawn tickets",
  cardDescription: "Status: Withdrawn",
  statusBadgeLabel: "Withdrawn",
  badgeVariant: "neutral",
  emptyMessage: "No withdrawn support tickets right now.",
  loadingMessage: "Loading withdrawn tickets…",
};

/** Technician portal: tickets assigned to the signed-in technician only (`mine=1`). */
export const TECHNICIAN_MY_TICKETS_IN_PROGRESS: AdminTicketsStatusConfig = {
  apiStatus: "In progress",
  pageTitle: "My in-progress tickets",
  pageDescription:
    "Support tickets assigned to you that are still in progress. Accept a ticket when you start handling it.",
  cardTitle: "In progress",
  cardDescription: "Assigned to you · status In progress",
  statusBadgeLabel: "In progress",
  badgeVariant: "warning",
  emptyMessage: "No in-progress tickets assigned to you.",
  loadingMessage: "Loading your in-progress tickets…",
};

export const TECHNICIAN_MY_TICKETS_ACCEPTED: AdminTicketsStatusConfig = {
  apiStatus: "Accepted",
  pageTitle: "My accepted tickets",
  pageDescription:
    "Tickets you accepted — mark them resolved when the work is finished (add optional resolution notes).",
  cardTitle: "Accepted",
  cardDescription: "Assigned to you · status Accepted",
  statusBadgeLabel: "Accepted",
  badgeVariant: "primary",
  emptyMessage: "No accepted tickets assigned to you.",
  loadingMessage: "Loading your accepted tickets…",
};

export const TECHNICIAN_MY_TICKETS_RESOLVED: AdminTicketsStatusConfig = {
  apiStatus: "Resolved",
  pageTitle: "My resolved tickets",
  pageDescription: "Tickets you completed (status Resolved).",
  cardTitle: "Resolved",
  cardDescription: "Assigned to you · status Resolved",
  statusBadgeLabel: "Resolved",
  badgeVariant: "success",
  emptyMessage: "No resolved tickets assigned to you yet.",
  loadingMessage: "Loading your resolved tickets…",
};

"use client";

import AdminSupportTicketsByStatus from "@/components/admin/AdminSupportTicketsByStatus";
import { ADMIN_TICKETS_IN_PROGRESS } from "@/components/admin/admin-ticket-status-config";

export default function AdminInProgressTicketsPage() {
  return <AdminSupportTicketsByStatus config={ADMIN_TICKETS_IN_PROGRESS} />;
}

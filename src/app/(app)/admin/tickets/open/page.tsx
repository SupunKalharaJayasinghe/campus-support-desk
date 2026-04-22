"use client";

import AdminSupportTicketsByStatus from "@/components/admin/AdminSupportTicketsByStatus";
import { ADMIN_TICKETS_OPEN } from "@/components/admin/admin-ticket-status-config";

export default function AdminOpenTicketsPage() {
  return <AdminSupportTicketsByStatus config={ADMIN_TICKETS_OPEN} />;
}

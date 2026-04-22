"use client";

import AdminSupportTicketsByStatus from "@/components/admin/AdminSupportTicketsByStatus";
import { ADMIN_TICKETS_RESOLVED } from "@/components/admin/admin-ticket-status-config";

export default function AdminResolvedTicketsPage() {
  return <AdminSupportTicketsByStatus config={ADMIN_TICKETS_RESOLVED} />;
}

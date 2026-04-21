"use client";

import AdminSupportTicketsByStatus from "@/components/admin/AdminSupportTicketsByStatus";
import { TECHNICIAN_MY_TICKETS_RESOLVED } from "@/components/admin/admin-ticket-status-config";

export default function TechnicianResolvedTicketsPage() {
  return <AdminSupportTicketsByStatus config={TECHNICIAN_MY_TICKETS_RESOLVED} mineOnly />;
}

"use client";

import AdminSupportTicketsByStatus from "@/components/admin/AdminSupportTicketsByStatus";
import { TECHNICIAN_MY_TICKETS_ACCEPTED } from "@/components/admin/admin-ticket-status-config";

export default function TechnicianAcceptedTicketsPage() {
  return (
    <AdminSupportTicketsByStatus
      config={TECHNICIAN_MY_TICKETS_ACCEPTED}
      mineOnly
      technicianWorkflow="resolve"
    />
  );
}

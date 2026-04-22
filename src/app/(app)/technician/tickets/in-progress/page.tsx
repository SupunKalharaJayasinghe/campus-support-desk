"use client";

import AdminSupportTicketsByStatus from "@/components/admin/AdminSupportTicketsByStatus";
import { TECHNICIAN_MY_TICKETS_IN_PROGRESS } from "@/components/admin/admin-ticket-status-config";

export default function TechnicianInProgressTicketsPage() {
  return (
    <AdminSupportTicketsByStatus
      config={TECHNICIAN_MY_TICKETS_IN_PROGRESS}
      mineOnly
      technicianWorkflow="accept"
    />
  );
}

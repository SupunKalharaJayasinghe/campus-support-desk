"use client";

import AdminSupportTicketsByStatus from "@/components/admin/AdminSupportTicketsByStatus";
import { ADMIN_TICKETS_WITHDRAWN } from "@/components/admin/admin-ticket-status-config";

export default function AdminWithdrawnTicketsPage() {
  return <AdminSupportTicketsByStatus config={ADMIN_TICKETS_WITHDRAWN} />;
}

"use client";

import Card from "@/components/ui/Card";

export default function AdminTicketsPage() {
  return (
    <div className="space-y-6">
      <Card
        accent
        description="Ticket management section for support requests."
        title="Tickets"
      >
        <div className="admin-empty-state rounded-3xl border border-border bg-card p-5 text-sm text-text/68">
          Ticket tools are available on the dashboard support ticket panel.
        </div>
      </Card>
    </div>
  );
}


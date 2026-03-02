"use client";

import { useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { lecturerBookingRequests } from "@/lib/mockData";
import type { LecturerBookingRequest } from "@/lib/mockData";

function badgeVariant(status: LecturerBookingRequest["status"]) {
  if (status === "Approved" || status === "Completed") {
    return "success" as const;
  }
  if (status === "Declined") {
    return "danger" as const;
  }
  return "warning" as const;
}

export default function LecturerBookingsPage() {
  const [requests, setRequests] = useState<LecturerBookingRequest[]>(lecturerBookingRequests);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Bookings</h1>
        <p className="text-sm text-text/72">Approve or decline student booking requests.</p>
      </div>

      <div className="space-y-3">
        {requests.map((request) => (
          <Card key={request.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-heading">{request.studentName}</p>
                <p className="text-sm text-text/72">{request.topic}</p>
                <p className="text-xs text-text/72">
                  {request.date} • {request.start} - {request.end}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={badgeVariant(request.status)}>{request.status}</Badge>
                {request.status === "Pending" ? (
                  <>
                    <Button
                      onClick={() =>
                        setRequests((prev) =>
                          prev.map((item) =>
                            item.id === request.id ? { ...item, status: "Approved" } : item
                          )
                        )
                      }
                      variant="secondary"
                    >
                      Approve
                    </Button>
                    <Button
                      onClick={() =>
                        setRequests((prev) =>
                          prev.map((item) =>
                            item.id === request.id ? { ...item, status: "Declined" } : item
                          )
                        )
                      }
                      variant="ghost"
                    >
                      Decline
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

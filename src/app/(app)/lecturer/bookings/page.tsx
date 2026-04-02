"use client";

import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { PORTAL_DATA_KEYS, loadPortalData, savePortalData } from "@/models/portal-data";
import type { ConsultationBooking } from "@/models/portal-types";
import { readStoredUser } from "@/models/rbac";

function badgeVariant(status: ConsultationBooking["status"]) {
  if (status === "Approved" || status === "Completed") {
    return "success" as const;
  }
  if (status === "Declined") {
    return "danger" as const;
  }
  return "warning" as const;
}

export default function LecturerBookingsPage() {
  const user = useMemo(() => readStoredUser(), []);
  const [allRequests, setAllRequests] = useState<ConsultationBooking[]>([]);

  const lecturerId = String(user?.id ?? "").trim();
  const lecturerName = String(user?.name ?? "")
    .trim()
    .toLowerCase();

  const requests = useMemo(() => {
    if (!lecturerId && !lecturerName) {
      return allRequests;
    }

    return allRequests.filter((item) => {
      if (lecturerId && String(item.lecturerUserId ?? "").trim() === lecturerId) {
        return true;
      }

      if (
        lecturerName &&
        String(item.lecturer ?? "").trim().toLowerCase() === lecturerName
      ) {
        return true;
      }

      return false;
    });
  }, [allRequests, lecturerId, lecturerName]);

  useEffect(() => {
    let cancelled = false;

    void loadPortalData<ConsultationBooking[]>(
      PORTAL_DATA_KEYS.consultationBookings,
      []
    ).then((rows) => {
      if (cancelled) {
        return;
      }

      setAllRequests(rows);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateStatus = (id: string, status: ConsultationBooking["status"]) => {
    const next = allRequests.map((item) =>
      item.id === id ? { ...item, status } : item
    );

    void savePortalData(PORTAL_DATA_KEYS.consultationBookings, next)
      .then((saved) => {
        setAllRequests(saved);
      })
      .catch(() => null);
  };

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
                      onClick={() => updateStatus(request.id, "Approved")}
                      variant="secondary"
                    >
                      Approve
                    </Button>
                    <Button
                      onClick={() => updateStatus(request.id, "Declined")}
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
        {requests.length === 0 ? (
          <Card>
            <p className="text-sm text-text/72">No booking requests found.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

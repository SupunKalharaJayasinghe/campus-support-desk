"use client";

import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { PORTAL_DATA_KEYS, loadPortalData, savePortalData } from "@/models/portal-data";
import type {
  AvailableLecturerSlotsGroup,
  ConsultationBooking,
  LecturerAvailabilitySlot,
} from "@/models/portal-types";
import { readStoredUser } from "@/models/rbac";

interface SelectedSlot {
  lecturerUserId: string;
  lecturer: string;
  department: string;
  date: string;
  start: string;
  end: string;
}

function bookingVariant(status: ConsultationBooking["status"]) {
  if (status === "Approved" || status === "Completed") {
    return "success" as const;
  }
  if (status === "Declined") {
    return "danger" as const;
  }
  return "warning" as const;
}

function groupSlotsByLecturer(
  slots: LecturerAvailabilitySlot[]
): AvailableLecturerSlotsGroup[] {
  const grouped = new Map<string, AvailableLecturerSlotsGroup>();

  slots.forEach((slot) => {
    const bucketKey = `${slot.lecturerUserId}:${slot.lecturer}`;
    const existing = grouped.get(bucketKey);
    if (existing) {
      existing.slots.push({
        id: slot.id,
        date: slot.date,
        start: slot.start,
        end: slot.end,
      });
      return;
    }

    grouped.set(bucketKey, {
      id: bucketKey,
      lecturer: slot.lecturer,
      department: slot.department,
      slots: [
        {
          id: slot.id,
          date: slot.date,
          start: slot.start,
          end: slot.end,
        },
      ],
    });
  });

  return Array.from(grouped.values()).map((entry) => ({
    ...entry,
    slots: [...entry.slots].sort((left, right) => {
      const dateCompare = left.date.localeCompare(right.date);
      if (dateCompare !== 0) {
        return dateCompare;
      }

      return left.start.localeCompare(right.start);
    }),
  }));
}

export default function StudentBookingPage() {
  const { toast } = useToast();
  const currentUser = useMemo(() => readStoredUser(), []);
  const [loading, setLoading] = useState(true);
  const [allBookings, setAllBookings] = useState<ConsultationBooking[]>([]);
  const [availableLecturerSlots, setAvailableLecturerSlots] = useState<
    AvailableLecturerSlotsGroup[]
  >([]);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);

  const currentUserId = String(currentUser?.id ?? "").trim();
  const currentUserName = String(currentUser?.name ?? "").trim() || "Student";

  const bookings = useMemo(() => {
    if (!currentUserId) {
      return allBookings;
    }

    return allBookings.filter(
      (item) => String(item.studentUserId ?? "").trim() === currentUserId
    );
  }, [allBookings, currentUserId]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      loadPortalData<ConsultationBooking[]>(PORTAL_DATA_KEYS.consultationBookings, []),
      loadPortalData<LecturerAvailabilitySlot[]>(PORTAL_DATA_KEYS.lecturerAvailability, []),
    ]).then(([bookingRows, slotRows]) => {
      if (cancelled) {
        return;
      }

      setAllBookings(bookingRows);
      setAvailableLecturerSlots(groupSlotsByLecturer(slotRows));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-24" />
        <Card>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="mt-3 h-16 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Booking</h1>
        <p className="text-sm text-text/72">Book and track lecturer consultation sessions.</p>
      </div>

      <Card title="Available Slots" description="Next 7 days lecturer availability">
        <div className="grid gap-4 md:grid-cols-2">
          {availableLecturerSlots.map((lecturer) => (
            <div className="rounded-xl border border-border p-4" key={lecturer.id}>
              <p className="text-sm font-semibold text-heading">{lecturer.lecturer}</p>
              <p className="text-xs text-text/72">{lecturer.department}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {lecturer.slots.map((slot) => (
                  <button
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-text/72 hover:bg-tint"
                    key={slot.id}
                    onClick={() =>
                      setSelectedSlot({
                        lecturerUserId: lecturer.id.split(":")[0] ?? "",
                        lecturer: lecturer.lecturer,
                        department: lecturer.department,
                        date: slot.date,
                        start: slot.start,
                        end: slot.end,
                      })
                    }
                    type="button"
                  >
                    {slot.date} • {slot.start}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {availableLecturerSlots.length === 0 ? (
            <p className="text-sm text-text/70">No lecturer slots available yet.</p>
          ) : null}
        </div>
      </Card>

      <Card title="My Bookings">
        <div className="space-y-3">
          {bookings.map((booking) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
              key={booking.id}
            >
              <div>
                <p className="text-sm font-semibold text-heading">{booking.lecturer}</p>
                <p className="text-sm text-text/72">{booking.topic}</p>
                <p className="text-xs text-text/72">
                  {booking.date} • {booking.start} - {booking.end}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={bookingVariant(booking.status)}>{booking.status}</Badge>
                <Button
                  disabled={booking.status === "Completed"}
                  onClick={() => {
                    const next = allBookings.filter((item) => item.id !== booking.id);
                    void savePortalData(PORTAL_DATA_KEYS.consultationBookings, next)
                      .then((saved) => {
                        setAllBookings(saved);
                        toast({
                          title: "Booking cancelled",
                          message: "Your booking request has been removed.",
                        });
                      })
                      .catch(() => {
                        toast({
                          title: "Cancellation failed",
                          message: "Try again in a moment.",
                        });
                      });
                  }}
                  variant="ghost"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ))}
          {bookings.length === 0 ? (
            <p className="text-sm text-text/70">No bookings yet.</p>
          ) : null}
        </div>
      </Card>

      {selectedSlot ? (
        <div className="fixed inset-0 z-40 bg-text/35 p-4">
          <div className="flex h-full items-center justify-center">
            <Card className="w-full max-w-lg">
              <h2 className="text-lg font-semibold text-heading">Confirm booking</h2>
              <p className="mt-2 text-sm text-text/72">{selectedSlot.lecturer}</p>
              <p className="mt-1 text-sm text-text/72">
                {selectedSlot.date} • {selectedSlot.start} - {selectedSlot.end}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <Button onClick={() => setSelectedSlot(null)} variant="ghost">
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const next: ConsultationBooking[] = [
                      {
                        id: `booking-${Date.now()}`,
                        studentUserId: currentUserId || `student-${Date.now()}`,
                        studentName: currentUserName,
                        lecturerUserId: selectedSlot.lecturerUserId,
                        lecturer: selectedSlot.lecturer,
                        department: selectedSlot.department,
                        topic: "Consultation",
                        date: selectedSlot.date,
                        start: selectedSlot.start,
                        end: selectedSlot.end,
                        status: "Pending",
                      },
                      ...allBookings,
                    ];

                    void savePortalData(PORTAL_DATA_KEYS.consultationBookings, next)
                      .then((saved) => {
                        setAllBookings(saved);
                        setSelectedSlot(null);
                        toast({
                          title: "Booking submitted",
                          message: "Your request was sent for lecturer approval.",
                        });
                      })
                      .catch(() => {
                        toast({
                          title: "Booking failed",
                          message: "Try again in a moment.",
                        });
                      });
                  }}
                >
                  Confirm booking
                </Button>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

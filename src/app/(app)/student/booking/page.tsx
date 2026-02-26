"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { availableLecturerSlots, studentBookings } from "@/lib/mockData";
import type { StudentBooking } from "@/lib/mockData";

interface SelectedSlot {
  lecturer: string;
  date: string;
  start: string;
  end: string;
}

function bookingVariant(status: StudentBooking["status"]) {
  if (status === "Approved" || status === "Completed") {
    return "success" as const;
  }
  if (status === "Declined") {
    return "danger" as const;
  }
  return "warning" as const;
}

export default function StudentBookingPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<StudentBooking[]>(studentBookings);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 500);
    return () => window.clearTimeout(timer);
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
        <h1 className="text-2xl font-semibold text-text">Booking</h1>
        <p className="text-sm text-mutedText">Book and track lecturer consultation sessions.</p>
      </div>

      <Card title="Available Slots" description="Next 7 days lecturer availability">
        <div className="grid gap-4 md:grid-cols-2">
          {availableLecturerSlots.map((lecturer) => (
            <div className="rounded-xl border border-border p-4" key={lecturer.id}>
              <p className="text-sm font-semibold text-text">{lecturer.lecturer}</p>
              <p className="text-xs text-mutedText">{lecturer.department}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {lecturer.slots.map((slot) => (
                  <button
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-mutedText hover:bg-surface2"
                    key={slot.id}
                    onClick={() =>
                      setSelectedSlot({
                        lecturer: lecturer.lecturer,
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
                <p className="text-sm font-semibold text-text">{booking.lecturer}</p>
                <p className="text-sm text-mutedText">{booking.purpose}</p>
                <p className="text-xs text-mutedText">
                  {booking.date} • {booking.time}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={bookingVariant(booking.status)}>{booking.status}</Badge>
                <Button
                  disabled={booking.status === "Completed"}
                  onClick={() =>
                    setBookings((prev) => prev.filter((item) => item.id !== booking.id))
                  }
                  variant="ghost"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {selectedSlot ? (
        <div className="fixed inset-0 z-40 bg-text/35 p-4">
          <div className="flex h-full items-center justify-center">
            <Card className="w-full max-w-lg">
              <h2 className="text-lg font-semibold text-text">Confirm booking</h2>
              <p className="mt-2 text-sm text-mutedText">{selectedSlot.lecturer}</p>
              <p className="mt-1 text-sm text-mutedText">
                {selectedSlot.date} • {selectedSlot.start} - {selectedSlot.end}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <Button onClick={() => setSelectedSlot(null)} variant="ghost">
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setBookings((prev) => [
                      {
                        id: `sb-${Date.now()}`,
                        lecturer: selectedSlot.lecturer,
                        purpose: "Consultation",
                        date: selectedSlot.date,
                        time: `${selectedSlot.start} - ${selectedSlot.end}`,
                        status: "Pending",
                      },
                      ...prev,
                    ]);
                    setSelectedSlot(null);
                    toast({
                      title: "Booking submitted",
                      message: "Your request was sent for lecturer approval.",
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

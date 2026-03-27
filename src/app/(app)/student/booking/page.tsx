"use client";

import { useEffect, useRef, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { availableLecturerSlots, studentBookings } from "@/models/mockData";
import type { StudentBooking } from "@/models/mockData";

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successTimerRef = useRef<number | null>(null);

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

  const confirmBooking = (slot: { date: string; start: string; end: string }, lecturer: string) => {
    setBookings((prev) => [
      {
        id: `sb-${Date.now()}`,
        lecturer,
        purpose: "Consultation",
        date: slot.date,
        time: `${slot.start} - ${slot.end}`,
        status: "Pending",
      },
      ...prev,
    ]);
    setSuccessMessage("Booking submitted");
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
    }
    successTimerRef.current = window.setTimeout(() => {
      setSuccessMessage(null);
      successTimerRef.current = null;
    }, 3000);
    toast({
      title: "Booking submitted",
      message: "Your request was sent for lecturer approval.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Booking</h1>
        <p className="text-sm text-text/72">Book and track lecturer consultation sessions.</p>
      </div>

      <Card className="relative" title="Available Slots" description="Next 7 days lecturer availability">
        {successMessage ? (
          <div className="absolute right-4 top-4 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
            {successMessage}
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          {availableLecturerSlots.map((lecturer) => (
            <div className="rounded-xl border border-border p-4" key={lecturer.id}>
              <p className="text-sm font-semibold text-heading">{lecturer.lecturer}</p>
              <p className="text-xs text-text/72">{lecturer.department}</p>
              <div className="mt-3 grid gap-2">
                {lecturer.slots.map((slot) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                    key={slot.id}
                  >
                    <div className="text-xs font-medium text-text/72">
                      {slot.date} • {slot.start}
                    </div>
                    <Button
                      className="h-8 px-3 text-xs"
                      onClick={() => confirmBooking(slot, lecturer.lecturer)}
                      variant="secondary"
                    >
                      Confirm
                    </Button>
                  </div>
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
                <p className="text-sm font-semibold text-heading">{booking.lecturer}</p>
                <p className="text-sm text-text/72">{booking.purpose}</p>
                <p className="text-xs text-text/72">
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
    </div>
  );
}


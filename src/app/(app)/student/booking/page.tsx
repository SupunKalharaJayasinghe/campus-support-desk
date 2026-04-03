"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import {
  createConsultationBooking,
  listAvailableConsultationSlots,
  listStudentConsultationBookings,
  toConsultationModeLabel,
  updateConsultationBooking,
  type ConsultationBookingApiRecord,
  type ConsultationSlotApiRecord,
} from "@/lib/consultation-client";
import {
  canCancelConsultationBooking,
  getConsultationBookingBadgeVariant,
  getConsultationBookingStatusLabel,
} from "@/models/consultation-booking";

function bookingVariant(status: ConsultationBookingApiRecord["status"]) {
  return getConsultationBookingBadgeVariant(status);
}

function buildSlotSubtitle(slot: ConsultationSlotApiRecord) {
  const location = slot.location ? ` • ${slot.location}` : "";
  return `${slot.date} • ${slot.startTime} - ${slot.endTime} • ${toConsultationModeLabel(slot.mode)}${location}`;
}

export default function StudentBookingPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [availableSlots, setAvailableSlots] = useState<ConsultationSlotApiRecord[]>([]);
  const [bookings, setBookings] = useState<ConsultationBookingApiRecord[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successTimerRef = useRef<number | null>(null);

  const loadData = useCallback(async () => {
    const [slotsPayload, bookingsPayload] = await Promise.all([
      listAvailableConsultationSlots(),
      listStudentConsultationBookings(),
    ]);

    setAvailableSlots(slotsPayload.items);
    setBookings(bookingsPayload.items);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await loadData();
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Booking data unavailable",
            message:
              error instanceof Error
                ? error.message
                : "Failed to load consultation data.",
            variant: "error",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current);
      }
    };
  }, [loadData, toast]);

  const groupedSlots = availableSlots.reduce<
    Array<{
      lecturerId: string;
      lecturerName: string;
      lecturerEmail: string;
      slots: ConsultationSlotApiRecord[];
    }>
  >((groups, slot) => {
    const lecturerId = slot.lecturer?.id ?? slot.lecturerId;
    const existing = groups.find((group) => group.lecturerId === lecturerId);
    if (existing) {
      existing.slots.push(slot);
      return groups;
    }

    groups.push({
      lecturerId,
      lecturerName: slot.lecturer?.fullName ?? "Lecturer",
      lecturerEmail: slot.lecturer?.email ?? "",
      slots: [slot],
    });
    return groups;
  }, []);

  const requestSlot = useCallback(
    async (slot: ConsultationSlotApiRecord) => {
      setBusyKey(`slot:${slot.id}`);
      try {
        const created = await createConsultationBooking({
          slotId: slot.id,
          purpose: slot.sessionType,
        });

        setBookings((prev) => [created, ...prev]);
        setAvailableSlots((prev) => prev.filter((item) => item.id !== slot.id));
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
          message: "Your request was sent for lecturer confirmation.",
        });
      } catch (error) {
        toast({
          title: "Booking failed",
          message:
            error instanceof Error
              ? error.message
              : "Failed to submit booking request.",
          variant: "error",
        });
      } finally {
        setBusyKey(null);
      }
    },
    [toast]
  );

  const cancelBooking = useCallback(
    async (booking: ConsultationBookingApiRecord) => {
      setBusyKey(`booking:${booking.id}`);
      try {
        const updated = await updateConsultationBooking(booking.id, {
          action: "cancel",
        });

        setBookings((prev) =>
          prev.map((item) => (item.id === booking.id ? updated : item))
        );

        if (updated.slot && updated.slot.status === "AVAILABLE") {
          const reopenedSlot: ConsultationSlotApiRecord = {
            ...updated.slot,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
            lecturer: updated.lecturer,
          };

          setAvailableSlots((prev) => {
            if (prev.some((item) => item.id === reopenedSlot.id)) {
              return prev;
            }

            return [reopenedSlot, ...prev];
          });
        }

        toast({
          title: "Booking cancelled",
          message: "The slot is available again.",
        });
      } catch (error) {
        toast({
          title: "Cancel failed",
          message:
            error instanceof Error ? error.message : "Failed to cancel booking.",
          variant: "error",
        });
      } finally {
        setBusyKey(null);
      }
    },
    [toast]
  );

  if (loading) {
    return (
      <div className="student-booking-page space-y-4">
        <Skeleton className="h-7 w-24" />
        <Card>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="mt-3 h-16 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="student-booking-page space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Booking</h1>
        <p className="text-sm text-text/72">
          Book and track lecturer consultation sessions.
        </p>
      </div>

      <Card
        className="relative"
        title="Available Slots"
        description="Live lecturer availability"
      >
        {successMessage ? (
          <div className="absolute right-4 top-4 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
            {successMessage}
          </div>
        ) : null}

        {groupedSlots.length === 0 ? (
          <p className="text-sm text-text/70">
            No consultation slots are currently available.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {groupedSlots.map((lecturer) => (
              <div
                className="student-soft-card rounded-xl border border-border p-4"
                key={lecturer.lecturerId}
              >
                <p className="text-sm font-semibold text-heading">
                  {lecturer.lecturerName}
                </p>
                <p className="text-xs text-text/72">
                  {lecturer.lecturerEmail || lecturer.lecturerId}
                </p>
                <div className="mt-3 grid gap-2">
                  {lecturer.slots.map((slot) => (
                    <div
                      className="student-soft-card flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                      key={slot.id}
                    >
                      <div>
                        <div className="text-xs font-semibold text-heading">
                          {slot.sessionType}
                        </div>
                        <div className="text-xs font-medium text-text/72">
                          {buildSlotSubtitle(slot)}
                        </div>
                      </div>
                      <Button
                        className="h-8 px-3 text-xs"
                        disabled={busyKey === `slot:${slot.id}`}
                        onClick={() => void requestSlot(slot)}
                        variant="secondary"
                      >
                        {busyKey === `slot:${slot.id}` ? "Requesting..." : "Request Slot"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="My Bookings">
        <div className="space-y-3">
          {bookings.length === 0 ? (
            <p className="text-sm text-text/70">No consultation bookings found.</p>
          ) : (
            bookings.map((booking) => (
              <div
                className="student-soft-card flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
                key={booking.id}
              >
                <div>
                  <p className="text-sm font-semibold text-heading">
                    {booking.lecturer?.fullName ?? booking.lecturerId}
                  </p>
                  <p className="text-sm text-text/72">{booking.purpose}</p>
                  <p className="text-xs text-text/72">
                    {booking.slot
                      ? `${booking.slot.date} • ${booking.slot.startTime} - ${booking.slot.endTime}`
                      : "Slot details unavailable"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={bookingVariant(booking.status)}>
                    {getConsultationBookingStatusLabel(booking.status)}
                  </Badge>
                  <Button
                    disabled={
                      !canCancelConsultationBooking(booking.status) ||
                      busyKey === `booking:${booking.id}`
                    }
                    onClick={() => void cancelBooking(booking)}
                    variant="ghost"
                  >
                    {busyKey === `booking:${booking.id}` ? "Cancelling..." : "Cancel"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

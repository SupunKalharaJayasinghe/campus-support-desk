"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/ToastProvider";
import { PORTAL_DATA_KEYS, loadPortalData, savePortalData } from "@/models/portal-data";
import type { LecturerAvailabilitySlot } from "@/models/portal-types";
import { readStoredUser } from "@/models/rbac";

function overlaps(a: LecturerAvailabilitySlot, b: LecturerAvailabilitySlot) {
  return a.date === b.date && a.start < b.end && b.start < a.end;
}

export default function LecturerAvailabilityPage() {
  const { toast } = useToast();
  const user = useMemo(() => readStoredUser(), []);
  const [allSlots, setAllSlots] = useState<LecturerAvailabilitySlot[]>([]);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");

  const lecturerUserId = String(user?.id ?? "").trim();
  const lecturerName = String(user?.name ?? "").trim() || "Lecturer";
  const department = user?.facultyCodes?.[0] ?? "General";

  const slots = useMemo(
    () =>
      allSlots
        .filter((slot) => {
          if (lecturerUserId) {
            return String(slot.lecturerUserId ?? "").trim() === lecturerUserId;
          }

          return String(slot.lecturer ?? "").trim() === lecturerName;
        })
        .sort((left, right) => {
          const dateCompare = left.date.localeCompare(right.date);
          if (dateCompare !== 0) {
            return dateCompare;
          }
          return left.start.localeCompare(right.start);
        }),
    [allSlots, lecturerName, lecturerUserId]
  );

  useEffect(() => {
    let cancelled = false;

    void loadPortalData<LecturerAvailabilitySlot[]>(
      PORTAL_DATA_KEYS.lecturerAvailability,
      []
    ).then((rows) => {
      if (cancelled) {
        return;
      }

      setAllSlots(rows);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const saveSlots = (next: LecturerAvailabilitySlot[]) => {
    void savePortalData(PORTAL_DATA_KEYS.lecturerAvailability, next)
      .then((saved) => {
        setAllSlots(saved);
      })
      .catch(() => {
        setError("Failed to save availability. Try again.");
      });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Availability</h1>
        <p className="text-sm text-text/72">Create and maintain your consultation windows.</p>
      </div>

      <Card title="Add time slot">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <Input onChange={(e) => setDate(e.target.value)} type="date" value={date} />
          <Input onChange={(e) => setStart(e.target.value)} type="time" value={start} />
          <Input onChange={(e) => setEnd(e.target.value)} type="time" value={end} />
          <Button
            onClick={() => {
              setError("");
              if (!date || !start || !end || start >= end) {
                setError("Provide a valid date and time range.");
                return;
              }

              const candidate: LecturerAvailabilitySlot = {
                id: `slot-${Date.now()}`,
                lecturerUserId: lecturerUserId || `lecturer-${Date.now()}`,
                lecturer: lecturerName,
                department,
                date,
                start,
                end,
              };

              if (slots.some((entry) => overlaps(entry, candidate))) {
                setError("This slot overlaps an existing entry.");
                return;
              }

              const next = [...allSlots, candidate];
              saveSlots(next);
              setDate("");
              setStart("");
              setEnd("");
              toast({ title: "Availability updated", message: "New slot added successfully." });
            }}
          >
            Add Slot
          </Button>
        </div>
        {error ? <p className="mt-2 text-sm text-primaryHover">{error}</p> : null}
      </Card>

      <Card title="My slots">
        <div className="space-y-2">
          {slots.map((slot) => (
            <div className="flex items-center justify-between rounded-xl bg-tint px-3 py-2" key={slot.id}>
              <p className="text-sm text-text/72">
                {slot.date} • {slot.start} - {slot.end}
              </p>
              <Button
                onClick={() => {
                  const next = allSlots.filter((entry) => entry.id !== slot.id);
                  saveSlots(next);
                }}
                variant="ghost"
              >
                Remove
              </Button>
            </div>
          ))}
          {slots.length === 0 ? (
            <p className="text-sm text-text/70">No availability slots added yet.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

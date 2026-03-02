"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/ToastProvider";
import { lecturerAvailabilitySeed } from "@/lib/mockData";
import type { LecturerSlot } from "@/lib/mockData";

function overlaps(a: LecturerSlot, b: LecturerSlot) {
  return a.date === b.date && a.start < b.end && b.start < a.end;
}

export default function LecturerAvailabilityPage() {
  const { toast } = useToast();
  const [slots, setSlots] = useState<LecturerSlot[]>(lecturerAvailabilitySeed);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");

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
              const candidate: LecturerSlot = { id: `ls-${Date.now()}`, date, start, end };
              if (slots.some((entry) => overlaps(entry, candidate))) {
                setError("This slot overlaps an existing entry.");
                return;
              }
              setSlots((prev) => [...prev, candidate]);
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
              <Button onClick={() => setSlots((prev) => prev.filter((entry) => entry.id !== slot.id))} variant="ghost">
                Remove
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

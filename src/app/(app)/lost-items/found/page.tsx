"use client";

import { useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { foundItemsSeed } from "@/lib/mockData";
import type { FoundItemRecord } from "@/lib/mockData";

function statusVariant(status: FoundItemRecord["status"]) {
  return status === "Returned" ? ("success" as const) : ("neutral" as const);
}

export default function FoundItemsPage() {
  const [items, setItems] = useState<FoundItemRecord[]>(foundItemsSeed);
  const [item, setItem] = useState("");
  const [location, setLocation] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-text">Found Register</h1>
        <p className="text-sm text-mutedText">Register found items and track return status.</p>
      </div>

      <Card title="Register found item">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input onChange={(event) => setItem(event.target.value)} placeholder="Item name" value={item} />
          <Input onChange={(event) => setLocation(event.target.value)} placeholder="Found location" value={location} />
          <Button
            onClick={() => {
              if (!item.trim() || !location.trim()) {
                return;
              }
              setItems((prev) => [
                {
                  id: `fi-${Date.now()}`,
                  item: item.trim(),
                  location: location.trim(),
                  recordedBy: "Nora Perera",
                  date: "Today",
                  status: "Stored",
                },
                ...prev,
              ]);
              setItem("");
              setLocation("");
            }}
          >
            Add
          </Button>
        </div>
      </Card>

      <Card title="Found items">
        <div className="space-y-3">
          {items.map((entry) => (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4" key={entry.id}>
              <div>
                <p className="text-sm font-semibold text-text">{entry.item}</p>
                <p className="text-sm text-mutedText">
                  {entry.location} • {entry.recordedBy}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(entry.status)}>{entry.status}</Badge>
                {entry.status === "Stored" ? (
                  <Button
                    onClick={() =>
                      setItems((prev) =>
                        prev.map((itemRow) =>
                          itemRow.id === entry.id ? { ...itemRow, status: "Returned" } : itemRow
                        )
                      )
                    }
                    variant="ghost"
                  >
                    Mark Returned
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

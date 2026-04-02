"use client";

import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { PORTAL_DATA_KEYS, loadPortalData, savePortalData } from "@/models/portal-data";
import type { FoundItemRecord } from "@/models/portal-types";
import { readStoredUser } from "@/models/rbac";

function statusVariant(status: FoundItemRecord["status"]) {
  return status === "Returned" ? ("success" as const) : ("neutral" as const);
}

export default function FoundItemsPage() {
  const user = useMemo(() => readStoredUser(), []);
  const [items, setItems] = useState<FoundItemRecord[]>([]);
  const [item, setItem] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    let cancelled = false;

    void loadPortalData<FoundItemRecord[]>(PORTAL_DATA_KEYS.foundItems, []).then((rows) => {
      if (cancelled) {
        return;
      }

      setItems(rows);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const persistItems = (next: FoundItemRecord[]) => {
    void savePortalData(PORTAL_DATA_KEYS.foundItems, next)
      .then((saved) => {
        setItems(saved);
      })
      .catch(() => null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Found Register</h1>
        <p className="text-sm text-text/72">Register found items and track return status.</p>
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

              persistItems([
                {
                  id: `found-${Date.now()}`,
                  item: item.trim(),
                  location: location.trim(),
                  recordedBy: String(user?.name ?? "Lost Item Officer"),
                  date: new Date().toLocaleDateString(),
                  status: "Stored",
                },
                ...items,
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
                <p className="text-sm font-semibold text-heading">{entry.item}</p>
                <p className="text-sm text-text/72">
                  {entry.location} • {entry.recordedBy}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(entry.status)}>{entry.status}</Badge>
                {entry.status === "Stored" ? (
                  <Button
                    onClick={() =>
                      persistItems(
                        items.map((itemRow) =>
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
          {items.length === 0 ? (
            <p className="text-sm text-text/72">No found items registered yet.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

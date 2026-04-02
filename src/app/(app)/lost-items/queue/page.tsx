"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { PORTAL_DATA_KEYS, loadPortalData, savePortalData } from "@/models/portal-data";
import type { LostItemReport } from "@/models/portal-types";

function statusVariant(status: LostItemReport["status"]) {
  if (status === "Claimed") {
    return "success" as const;
  }
  if (status === "Verified") {
    return "warning" as const;
  }
  return "danger" as const;
}

export default function LostItemsQueuePage() {
  const [reports, setReports] = useState<LostItemReport[]>([]);

  useEffect(() => {
    let cancelled = false;

    void loadPortalData<LostItemReport[]>(PORTAL_DATA_KEYS.lostItemReports, []).then(
      (rows) => {
        if (cancelled) {
          return;
        }

        setReports(rows);
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const updateReports = (next: LostItemReport[]) => {
    void savePortalData(PORTAL_DATA_KEYS.lostItemReports, next)
      .then((saved) => {
        setReports(saved);
      })
      .catch(() => null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Queue</h1>
        <p className="text-sm text-text/72">Review reported items and process claim verification.</p>
      </div>
      <div className="space-y-3">
        {reports.map((report) => (
          <Card key={report.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-heading">{report.item}</p>
                <p className="text-sm text-text/72">
                  {report.location} • {report.reporter}
                </p>
                <p className="text-xs text-text/72">{report.date}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(report.status)}>{report.status}</Badge>
                {report.status === "Pending Review" ? (
                  <Button
                    onClick={() =>
                      updateReports(
                        reports.map((item) =>
                          item.id === report.id ? { ...item, status: "Verified" } : item
                        )
                      )
                    }
                    variant="secondary"
                  >
                    Verify
                  </Button>
                ) : null}
                {report.status === "Verified" ? (
                  <Button
                    onClick={() =>
                      updateReports(
                        reports.map((item) =>
                          item.id === report.id ? { ...item, status: "Claimed" } : item
                        )
                      )
                    }
                    variant="ghost"
                  >
                    Mark Claimed
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
        {reports.length === 0 ? (
          <Card>
            <p className="text-sm text-text/72">No queue reports available.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

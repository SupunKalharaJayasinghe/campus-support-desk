"use client";

import { useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { moderationReportsSeed } from "@/lib/mockData";
import type { ModerationReport } from "@/lib/mockData";

function statusVariant(status: ModerationReport["status"]) {
  if (status === "Resolved") {
    return "success" as const;
  }
  if (status === "Under Review") {
    return "warning" as const;
  }
  return "danger" as const;
}

export default function AdminModerationPage() {
  const [reports, setReports] = useState<ModerationReport[]>(moderationReportsSeed);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Moderation</h1>
        <p className="text-sm text-slate-500">Review reports and take moderation actions.</p>
      </div>
      <div className="space-y-3">
        {reports.map((report) => (
          <Card key={report.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{report.target}</p>
                <p className="text-sm text-slate-600">Reason: {report.reason}</p>
                <p className="text-xs text-slate-500">Reported by: {report.submittedBy}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(report.status)}>{report.status}</Badge>
                {report.status === "Open" ? (
                  <Button
                    onClick={() =>
                      setReports((prev) =>
                        prev.map((item) =>
                          item.id === report.id ? { ...item, status: "Under Review" } : item
                        )
                      )
                    }
                    variant="secondary"
                  >
                    Review
                  </Button>
                ) : null}
                {report.status !== "Resolved" ? (
                  <Button
                    onClick={() =>
                      setReports((prev) =>
                        prev.map((item) =>
                          item.id === report.id ? { ...item, status: "Resolved" } : item
                        )
                      )
                    }
                    variant="ghost"
                  >
                    Resolve
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export type ReportStatus = "OPEN" | "REVIEWED" | "AGREED" | "DISMISSED";
export type ReportPriority = "High" | "Medium" | "Low";

export interface ReportedPost {
  id: string;
  /** Community post id (Mongo _id of the reported post). */
  postId: string;
  reportedBy: string;
  postAuthor: string;
  category: "academic_question" | "study_material" | "lost_item";
  reason: string;
  reportedAt: string;
  priority: ReportPriority;
  status: ReportStatus;
  postTitle: string;
  postSummary: string;
  updatedAt: string;
  adminReviewAcknowledged: boolean;
  reviewComment: string;
}

export function priorityFromReasonKey(reasonKey: string): ReportPriority {
  if (reasonKey === "harassment") return "High";
  if (reasonKey === "inappropriate" || reasonKey === "misinformation") return "Medium";
  return "Low";
}

function mongoIdString(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && !Array.isArray(value) && value !== null) {
    const o = value as Record<string, unknown>;
    if (o._id !== undefined) return String(o._id).trim();
  }
  return String(value).trim();
}

function formatReportedAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso || "—";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function mapApiReportToRow(raw: unknown): ReportedPost | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const id = String(r._id ?? "").trim();
  if (!id) return null;

  const post = r.postId;
  let postTitle = "";
  let postSummary = "";
  let category: ReportedPost["category"] = "academic_question";
  let postAuthor = "Unknown";
  let postId = "";

  if (post && typeof post === "object" && !Array.isArray(post)) {
    const p = post as Record<string, unknown>;
    postId = mongoIdString(p._id);
    postTitle = String(p.title ?? "").trim();
    postSummary = String(p.description ?? "").trim();
    const cat = String(p.category ?? "");
    if (cat === "lost_item" || cat === "study_material" || cat === "academic_question") {
      category = cat;
    }
    postAuthor = String(p.authorDisplayName ?? "").trim() || "Unknown";
  }
  if (!postId) {
    postId = mongoIdString(r.postId);
  }

  const reporter = r.userId;
  let reportedBy = "Unknown";
  if (reporter && typeof reporter === "object" && !Array.isArray(reporter)) {
    const u = reporter as Record<string, unknown>;
    reportedBy =
      String(u.username ?? "").trim() ||
      String(u.email ?? "").trim() ||
      "Unknown";
  }

  const statusRaw = String(r.status ?? "OPEN").toUpperCase();
  const status: ReportStatus =
    statusRaw === "REVIEWED" ||
    statusRaw === "AGREED" ||
    statusRaw === "DISMISSED" ||
    statusRaw === "OPEN"
      ? statusRaw
      : "OPEN";

  const reasonKey = typeof r.reasonKey === "string" ? r.reasonKey : "";
  const priority = priorityFromReasonKey(reasonKey);

  const reason = String(r.reason ?? "").trim();
  const details = typeof r.details === "string" ? r.details.trim() : "";
  const reasonText =
    details && reason && !reason.includes(details)
      ? `${reason}\n${details}`
      : reason || details || "—";

  const createdRaw = r.createdAt;
  const updatedRaw = r.updatedAt;
  const createdIso =
    createdRaw instanceof Date
      ? createdRaw.toISOString()
      : typeof createdRaw === "string"
        ? createdRaw
        : "";
  const updatedIso =
    updatedRaw instanceof Date
      ? updatedRaw.toISOString()
      : typeof updatedRaw === "string"
        ? updatedRaw
        : "";

  const adminReviewAcknowledged = r.adminReviewAcknowledged === true;
  const reviewComment =
    typeof r.reviewComment === "string" ? r.reviewComment.trim() : "";
  return {
    id,
    postId: postId || "—",
    reportedBy,
    postAuthor,
    category,
    reason: reasonText,
    reportedAt: formatReportedAt(createdIso),
    priority,
    status,
    postTitle: postTitle || "—",
    postSummary: postSummary || "—",
    updatedAt: updatedIso,
    adminReviewAcknowledged,
    reviewComment,
  };
}

export function categoryLabel(value: ReportedPost["category"]) {
  if (value === "academic_question") return "Academic Question";
  if (value === "study_material") return "Study Material";
  return "Lost Item";
}

export function reportListLabel(mongoId: string) {
  const tail = mongoId.replace(/\s/g, "").slice(-6).toUpperCase();
  return tail.length >= 4 ? `RPT-${tail}` : mongoId;
}

export function isClosedToday(iso: string) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

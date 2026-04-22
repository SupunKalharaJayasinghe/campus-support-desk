import mongoose, { Schema } from "mongoose";
import {
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_STATUSES,
  type ISupportTicket,
} from "./support-ticket-types";

export * from "./support-ticket-types";

const EvidenceSchema = new Schema(
  {
    fileName: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, required: true, trim: true, maxlength: 120 },
    data: { type: String, required: true },
  },
  { _id: false }
);

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    subcategory: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },
    contactEmail: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    contactPhone: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    contactWhatsapp: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    priority: {
      type: String,
      required: true,
      enum: SUPPORT_TICKET_PRIORITIES,
      default: "Medium",
    },
    status: {
      type: String,
      required: true,
      enum: SUPPORT_TICKET_STATUSES,
      default: "Open",
    },
    evidence: {
      type: [EvidenceSchema],
      default: [],
    },
    assignedTechnicianId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    technicianComments: {
      type: String,
      trim: true,
      maxlength: 10000,
    },
    technicianEvidence: {
      type: [EvidenceSchema],
      default: [],
    },
    withdrawalReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

SupportTicketSchema.index({ studentId: 1, createdAt: -1 });
SupportTicketSchema.index({ assignedTechnicianId: 1, status: 1 });

/**
 * Next.js dev hot-reload can keep a stale compiled model without newer paths (e.g.
 * `assignedTechnicianId`), which triggers StrictPopulateError on populate. Drop the cached
 * model so this file's schema is always the one registered.
 */
if (mongoose.models.SupportTicket) {
  mongoose.deleteModel("SupportTicket");
}

const SupportTicketModel = mongoose.model<ISupportTicket>(
  "SupportTicket",
  SupportTicketSchema
);

export { SupportTicketModel };

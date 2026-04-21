import mongoose, { Schema, Types } from "mongoose";

export const SUPPORT_TICKET_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
export const SUPPORT_TICKET_STATUSES = ["Open", "In progress", "Resolved"] as const;

export type SupportTicketPriority = (typeof SUPPORT_TICKET_PRIORITIES)[number];
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export interface ISupportTicketEvidence {
  fileName: string;
  mimeType: string;
  /** Base64-encoded file bytes (no data-URL prefix). */
  data: string;
}

export interface ISupportTicket {
  studentId: Types.ObjectId;
  subject: string;
  category: string;
  subcategory: string;
  description: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  evidence?: ISupportTicketEvidence[];
  createdAt?: Date;
  updatedAt?: Date;
}

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
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

SupportTicketSchema.index({ studentId: 1, createdAt: -1 });

const SupportTicketModel =
  mongoose.models.SupportTicket ||
  mongoose.model<ISupportTicket>("SupportTicket", SupportTicketSchema);

export { SupportTicketModel };

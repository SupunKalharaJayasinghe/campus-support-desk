import mongoose, { Schema, Types } from "mongoose";
import {
  CONSULTATION_BOOKING_STATUSES,
  type ConsultationBookingStatus,
} from "@/models/consultation-booking";

const CANCELLATION_ACTORS = ["STUDENT", "LECTURER", "SYSTEM"] as const;

type CancellationActor = (typeof CANCELLATION_ACTORS)[number];

export interface IConsultationBooking {
  slotId: Types.ObjectId;
  lecturerId: Types.ObjectId;
  studentId: Types.ObjectId;
  purpose: string;
  status: ConsultationBookingStatus;
  confirmedAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  cancelledByRole?: CancellationActor | null;
  cancelledReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const ConsultationBookingSchema = new Schema<IConsultationBooking>(
  {
    slotId: {
      type: Schema.Types.ObjectId,
      ref: "ConsultationAvailabilitySlot",
      required: true,
      index: true,
    },
    lecturerId: {
      type: Schema.Types.ObjectId,
      ref: "Lecturer",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: CONSULTATION_BOOKING_STATUSES,
      default: "PENDING",
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledByRole: {
      type: String,
      enum: CANCELLATION_ACTORS,
      default: null,
    },
    cancelledReason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

ConsultationBookingSchema.index({ slotId: 1, status: 1 });
ConsultationBookingSchema.index({ lecturerId: 1, status: 1, createdAt: -1 });
ConsultationBookingSchema.index({ studentId: 1, status: 1, createdAt: -1 });

const ConsultationBookingModel =
  (mongoose.models.ConsultationBooking as
    | mongoose.Model<IConsultationBooking>
    | undefined) ||
  mongoose.model<IConsultationBooking>(
    "ConsultationBooking",
    ConsultationBookingSchema
  );

export { ConsultationBookingModel, ConsultationBookingSchema };

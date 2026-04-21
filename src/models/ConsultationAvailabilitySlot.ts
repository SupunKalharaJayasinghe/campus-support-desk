import mongoose, { Schema, Types } from "mongoose";
import {
  CONSULTATION_SLOT_MODES,
  CONSULTATION_SLOT_STATUSES,
  type ConsultationSlotMode,
  type ConsultationSlotStatus,
} from "@/models/consultation-availability";

export interface IConsultationAvailabilitySlot {
  lecturerId: Types.ObjectId;
  date: string;
  startTime: string;
  endTime: string;
  sessionType: string;
  mode: ConsultationSlotMode;
  location: string;
  meetingLink: string;
  status: ConsultationSlotStatus;
  bookingId?: Types.ObjectId | null;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const ConsultationAvailabilitySlotSchema = new Schema<IConsultationAvailabilitySlot>(
  {
    lecturerId: {
      type: Schema.Types.ObjectId,
      ref: "Lecturer",
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      trim: true,
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
    },
    sessionType: {
      type: String,
      required: true,
      trim: true,
    },
    mode: {
      type: String,
      required: true,
      enum: CONSULTATION_SLOT_MODES,
      default: "IN_PERSON",
    },
    location: {
      type: String,
      trim: true,
      default: "",
    },
    meetingLink: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      required: true,
      enum: CONSULTATION_SLOT_STATUSES,
      default: "AVAILABLE",
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "ConsultationBooking",
      default: null,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

ConsultationAvailabilitySlotSchema.index(
  {
    lecturerId: 1,
    date: 1,
    startTime: 1,
    endTime: 1,
    isDeleted: 1,
  },
  { unique: true }
);
ConsultationAvailabilitySlotSchema.index({ status: 1, date: 1, startTime: 1 });

const existingModel = mongoose.models.ConsultationAvailabilitySlot as
  | mongoose.Model<IConsultationAvailabilitySlot>
  | undefined;
if (existingModel && !existingModel.schema.path("meetingLink")) {
  delete mongoose.models.ConsultationAvailabilitySlot;
}

const ConsultationAvailabilitySlotModel =
  (mongoose.models.ConsultationAvailabilitySlot as
    | mongoose.Model<IConsultationAvailabilitySlot>
    | undefined) ||
  mongoose.model<IConsultationAvailabilitySlot>(
    "ConsultationAvailabilitySlot",
    ConsultationAvailabilitySlotSchema
  );

export { ConsultationAvailabilitySlotModel, ConsultationAvailabilitySlotSchema };

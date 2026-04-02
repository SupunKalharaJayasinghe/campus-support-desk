import mongoose, { Schema, Types } from "mongoose";
import {
  CONSULTATION_NOTIFICATION_RECIPIENT_ROLES,
  CONSULTATION_NOTIFICATION_TYPES,
  type ConsultationNotificationRecipientRole,
  type ConsultationNotificationType,
} from "@/models/consultation-notification";

export interface IConsultationNotification {
  notificationKey: string;
  recipientRole: ConsultationNotificationRecipientRole;
  recipientId: Types.ObjectId | string;
  bookingId: Types.ObjectId;
  type: ConsultationNotificationType;
  title: string;
  message: string;
  readAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const ConsultationNotificationSchema = new Schema<IConsultationNotification>(
  {
    notificationKey: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    recipientRole: {
      type: String,
      required: true,
      enum: CONSULTATION_NOTIFICATION_RECIPIENT_ROLES,
      index: true,
    },
    recipientId: {
      type: Schema.Types.Mixed,
      required: true,
      index: true,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "ConsultationBooking",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: CONSULTATION_NOTIFICATION_TYPES,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

ConsultationNotificationSchema.index({ recipientRole: 1, recipientId: 1, createdAt: -1 });
ConsultationNotificationSchema.index({ bookingId: 1, type: 1, recipientRole: 1 });

const ConsultationNotificationModel =
  (mongoose.models.ConsultationNotification as
    | mongoose.Model<IConsultationNotification>
    | undefined) ||
  mongoose.model<IConsultationNotification>(
    "ConsultationNotification",
    ConsultationNotificationSchema
  );

export { ConsultationNotificationModel, ConsultationNotificationSchema };

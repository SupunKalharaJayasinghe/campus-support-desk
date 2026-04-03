import mongoose, { Schema } from "mongoose";

const AnnouncementSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    targetLabel: {
      type: String,
      required: true,
      trim: true,
      default: "All users",
      maxlength: 140,
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
      default: "Admin",
      maxlength: 120,
    },
    authorUserId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    authorRole: {
      type: String,
      trim: true,
      default: "",
      maxlength: 40,
    },
    authorEmail: {
      type: String,
      trim: true,
      default: "",
      lowercase: true,
      maxlength: 254,
    },
    updatedBy: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    updatedByUserId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    updatedByRole: {
      type: String,
      trim: true,
      default: "",
      maxlength: 40,
    },
    updatedByEmail: {
      type: String,
      trim: true,
      default: "",
      lowercase: true,
      maxlength: 254,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    deletedByUserId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    deletedByRole: {
      type: String,
      trim: true,
      default: "",
      maxlength: 40,
    },
    deletedByEmail: {
      type: String,
      trim: true,
      default: "",
      lowercase: true,
      maxlength: 254,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

AnnouncementSchema.index({ createdAt: -1 });
AnnouncementSchema.index({ isDeleted: 1, createdAt: -1 });

const AnnouncementModel =
  mongoose.models.Announcement || mongoose.model("Announcement", AnnouncementSchema);

export { AnnouncementModel, AnnouncementSchema };

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
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

AnnouncementSchema.index({ createdAt: -1 });

const AnnouncementModel =
  mongoose.models.Announcement || mongoose.model("Announcement", AnnouncementSchema);

export { AnnouncementModel, AnnouncementSchema };

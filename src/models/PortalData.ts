import mongoose, { Schema } from "mongoose";

const PortalDataSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    value: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const PortalDataModel =
  mongoose.models.PortalData ||
  mongoose.model("PortalData", PortalDataSchema);

export { PortalDataModel, PortalDataSchema };

import mongoose, { Schema } from "mongoose";

const OutlineTemplateSchema = new Schema(
  {
    weekNo: { type: Number, required: true, min: 1, max: 60 },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ["LECTURE", "MID", "QUIZ", "LAB", "OTHER"], default: "LECTURE" },
  },
  { _id: false }
);

const ModuleSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    name: { type: String, required: true, trim: true },
    credits: { type: Number, required: true, min: 1, max: 30 },
    facultyCode: { type: String, required: true, trim: true, uppercase: true },
    applicableTerms: {
      type: [String],
      required: true,
      default: [],
      enum: ["Y1S1", "Y1S2", "Y2S1", "Y2S2", "Y3S1", "Y3S2", "Y4S1", "Y4S2"],
    },
    applicableDegrees: { type: [String], required: true, default: [] },
    defaultSyllabusVersion: {
      type: String,
      required: true,
      enum: ["OLD", "NEW"],
      default: "NEW",
    },
    outlineTemplate: { type: [OutlineTemplateSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const ModuleModel =
  mongoose.models.Module || mongoose.model("Module", ModuleSchema);

export { ModuleModel, ModuleSchema };

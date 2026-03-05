import mongoose, { Schema } from "mongoose";

const CounterSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, unique: true },
    seq: { type: Number, required: true, default: 0, min: 0 },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

const CounterModel =
  mongoose.models.Counter || mongoose.model("Counter", CounterSchema);

export { CounterModel, CounterSchema };

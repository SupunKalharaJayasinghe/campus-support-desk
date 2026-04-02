import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI?.trim();
const dbName = process.env.MONGODB_DB?.trim() || undefined;
const fullName = process.env.ADMIN_FULL_NAME?.trim() || "System Admin";
const username = process.env.ADMIN_USERNAME?.trim() || "admin";
const email = (process.env.ADMIN_EMAIL?.trim() || "admin@campus.local").toLowerCase();
const password = process.env.ADMIN_PASSWORD?.trim() || "Admin@12345";
const rawRole = String(process.env.ADMIN_ROLE ?? "ADMIN").trim().toUpperCase();
const role = rawRole === "LOST_ITEM_ADMIN" ? "LOST_ITEM_ADMIN" : "ADMIN";

if (!uri) {
  console.error("MONGODB_URI is not set. Add it to your environment before seeding.");
  process.exit(1);
}

if (password.length < 8) {
  console.error("ADMIN_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true, default: "", maxlength: 160 },
    username: { type: String, required: true, trim: true, unique: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    role: {
      type: String,
      required: true,
      enum: ["ADMIN", "LOST_ITEM_ADMIN", "LECTURER", "LAB_ASSISTANT", "STUDENT"],
      default: "STUDENT",
    },
    passwordHash: { type: String, required: true },
    mustChangePassword: { type: Boolean, default: true },
    status: {
      type: String,
      required: true,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
    studentRef: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
    lecturerRef: { type: mongoose.Schema.Types.ObjectId, ref: "Lecturer", default: null },
    labAssistantRef: { type: mongoose.Schema.Types.ObjectId, ref: "LabAssistant", default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const UserModel = mongoose.models.User || mongoose.model("User", UserSchema);

async function seedAdmin() {
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 5000 });

  const passwordHash = await bcrypt.hash(password, 10);
  const existingUser = await UserModel.findOne({
    $or: [{ username }, { email }],
  })
    .select({ _id: 1 })
    .lean()
    .exec();

  if (existingUser?._id) {
    await UserModel.updateOne(
      { _id: existingUser._id },
      {
        $set: {
          username,
          email,
          fullName,
          role,
          passwordHash,
          status: "ACTIVE",
          mustChangePassword: false,
        },
      }
    ).exec();

    console.log(`Updated admin user: ${String(existingUser._id)}`);
  } else {
    const createdUser = await UserModel.create({
      username,
      email,
      fullName,
      role,
      passwordHash,
      status: "ACTIVE",
      mustChangePassword: false,
    });

    console.log(`Created admin user: ${String(createdUser._id)}`);
  }

  console.log(`Full Name: ${fullName}`);
  console.log(`Username: ${username}`);
  console.log(`Email: ${email}`);
  console.log(`Role: ${role}`);
  console.log(`Password: ${password}`);
}

seedAdmin()
  .catch((error) => {
    console.error(`Failed to seed admin user: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => null);
  });

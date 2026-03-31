import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI?.trim();
const dbName = process.env.MONGODB_DB?.trim() || undefined;

// Fixed student credentials as requested
const username = "IT12345678";
const email =
  (process.env.STUDENT_SEED_EMAIL?.trim() || "IT12345678@my.sllit.lk").toLowerCase();
const password = process.env.STUDENT_SEED_PASSWORD?.trim() || "12345678";

if (!uri) {
  console.error(
    "MONGODB_URI is not set. Add it to your environment before seeding student user."
  );
  process.exit(1);
}

if (password.length < 4) {
  console.error("STUDENT_SEED_PASSWORD must be at least 4 characters.");
  process.exit(1);
}

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, unique: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    role: {
      type: String,
      required: true,
      enum: ["ADMIN", "LECTURER", "LAB_ASSISTANT", "STUDENT"],
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
    labAssistantRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabAssistant",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const UserModel = mongoose.models.User || mongoose.model("User", UserSchema);

async function seedStudent() {
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 5000 });

  const passwordHash = await bcrypt.hash(password, 10);

  // Look for an existing user by username or email
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
          role: "STUDENT",
          passwordHash,
          status: "ACTIVE",
          mustChangePassword: true,
        },
      }
    ).exec();

    console.log(`Updated student user: ${String(existingUser._id)}`);
  } else {
    const createdUser = await UserModel.create({
      username,
      email,
      role: "STUDENT",
      passwordHash,
      status: "ACTIVE",
      mustChangePassword: true,
    });

    console.log(`Created student user: ${String(createdUser._id)}`);
  }

  console.log(`Username: ${username}`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

seedStudent()
  .catch((error) => {
    console.error(
      `Failed to seed student user: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => null);
  });


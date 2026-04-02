import bcrypt from "bcryptjs";
import { existsSync, readFileSync } from "fs";
import mongoose from "mongoose";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvFile(filename) {
  const path = resolve(root, filename);
  if (!existsSync(path)) {
    return;
  }

  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const uri = process.env.MONGODB_URI?.trim();
const dbName = process.env.MONGODB_DB?.trim() || undefined;

if (!uri) {
  console.error("MONGODB_URI is not set. Add it to .env or .env.local before running this script.");
  process.exit(1);
}

const ObjectId = mongoose.Types.ObjectId;

const lecturerSeed = {
  email: "amaya.perera@unihub.local",
  username: "amaya.perera@unihub.local",
  password: "Lecturer@123",
  fullName: "Dr. Amaya Perera",
  phone: "0771234567",
  nicStaffId: "LEC20260403",
};

const studentSeed = {
  studentId: "IT2606001",
  email: "it2606001@my.sllit.lk",
  password: "Student@123",
  firstName: "Nethmi",
  lastName: "Fernando",
  nicNumber: "200012345678",
  phone: "0712345678",
};

const sharedAcademic = {
  facultyId: "FOC",
  degreeProgramId: "SE",
  intakeId: "intk-2026-june-foc-se",
  intakeName: "2026 June",
  termCode: "Y1S1",
  moduleId: "SE101",
  moduleCode: "SE101",
  moduleName: "Programming Fundamentals",
};

const publishedQuizQuestionIds = {
  q1: new ObjectId("661000000000000000000101"),
  q1o1: new ObjectId("661000000000000000000111"),
  q1o2: new ObjectId("661000000000000000000112"),
  q1o3: new ObjectId("661000000000000000000113"),
  q2: new ObjectId("661000000000000000000102"),
  q2o1: new ObjectId("661000000000000000000121"),
  q2o2: new ObjectId("661000000000000000000122"),
  q2o3: new ObjectId("661000000000000000000123"),
};

const closedQuizQuestionIds = {
  q1: new ObjectId("661000000000000000000201"),
  q1o1: new ObjectId("661000000000000000000211"),
  q1o2: new ObjectId("661000000000000000000212"),
  q1o3: new ObjectId("661000000000000000000213"),
  q2: new ObjectId("661000000000000000000202"),
  q2o1: new ObjectId("661000000000000000000221"),
  q2o2: new ObjectId("661000000000000000000222"),
  q2o3: new ObjectId("661000000000000000000223"),
};

function iso(value) {
  return new Date(value).toISOString();
}

function splitSrvUri(input) {
  const trimmed = String(input ?? "").trim();
  const scheme = "mongodb+srv://";
  if (!trimmed.startsWith(scheme)) {
    return null;
  }

  const withoutScheme = trimmed.slice(scheme.length);
  const slashIndex = withoutScheme.indexOf("/");
  const authority = slashIndex >= 0 ? withoutScheme.slice(0, slashIndex) : withoutScheme;
  const rest = slashIndex >= 0 ? withoutScheme.slice(slashIndex + 1) : "";
  const atIndex = authority.lastIndexOf("@");
  const auth = atIndex >= 0 ? authority.slice(0, atIndex) : "";
  const host = atIndex >= 0 ? authority.slice(atIndex + 1) : authority;
  const queryIndex = rest.indexOf("?");
  const database = queryIndex >= 0 ? rest.slice(0, queryIndex) : rest;
  const query = queryIndex >= 0 ? rest.slice(queryIndex + 1) : "";

  return {
    auth,
    host,
    database,
    query,
  };
}

async function resolveDnsJson(name, type) {
  const endpoints = [
    "https://dns.google/resolve",
    "https://cloudflare-dns.com/dns-query",
  ];

  for (const endpoint of endpoints) {
    try {
      const separator = endpoint.includes("?") ? "&" : "?";
      const response = await fetch(
        `${endpoint}${separator}name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`,
        {
          headers: {
            accept: "application/dns-json",
          },
        }
      );

      if (!response.ok) {
        continue;
      }

      const payload = await response.json().catch(() => null);
      if (payload && typeof payload === "object") {
        return payload;
      }
    } catch {
      // Try the next DNS-over-HTTPS provider.
    }
  }

  return null;
}

function parseSrvHosts(payload) {
  const answers = Array.isArray(payload?.Answer) ? payload.Answer : [];
  return answers
    .map((answer) => String(answer?.data ?? "").trim())
    .map((value) => {
      const parts = value.split(/\s+/);
      if (parts.length < 4) {
        return null;
      }

      const port = parts[2];
      const host = parts[3].replace(/\.$/, "");
      if (!host || !port) {
        return null;
      }

      return `${host}:${port}`;
    })
    .filter(Boolean);
}

function parseTxtOptions(payload) {
  const answers = Array.isArray(payload?.Answer) ? payload.Answer : [];
  const combined = answers
    .map((answer) => String(answer?.data ?? "").trim())
    .filter(Boolean)
    .map((value) => value.replace(/^"+|"+$/g, "").replace(/" "/g, ""))
    .join("&");

  return combined;
}

function mergeQueryStrings(primary, secondary) {
  const params = new URLSearchParams();

  const apply = (input) => {
    const next = new URLSearchParams(String(input ?? ""));
    for (const [key, value] of next.entries()) {
      params.set(key, value);
    }
  };

  apply(secondary);
  apply(primary);

  if (!params.has("ssl") && !params.has("tls")) {
    params.set("ssl", "true");
  }

  return params.toString();
}

async function expandMongoSrvUri(input) {
  const parsed = splitSrvUri(input);
  if (!parsed?.host) {
    throw new Error("Invalid mongodb+srv connection string");
  }

  const [srvPayload, txtPayload] = await Promise.all([
    resolveDnsJson(`_mongodb._tcp.${parsed.host}`, "SRV"),
    resolveDnsJson(parsed.host, "TXT"),
  ]);

  const hosts = parseSrvHosts(srvPayload);
  if (hosts.length === 0) {
    throw new Error("Unable to resolve MongoDB SRV hosts over HTTPS");
  }

  const txtOptions = parseTxtOptions(txtPayload);
  const mergedQuery = mergeQueryStrings(parsed.query, txtOptions);
  const authPrefix = parsed.auth ? `${parsed.auth}@` : "";
  const databasePath = parsed.database || "";

  return `mongodb://${authPrefix}${hosts.join(",")}/${databasePath}${
    mergedQuery ? `?${mergedQuery}` : ""
  }`;
}

async function connectWithFallback(inputUri) {
  try {
    await mongoose.connect(inputUri, {
      dbName,
      serverSelectionTimeoutMS: 10000,
    });
    return inputUri;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!String(inputUri).startsWith("mongodb+srv://") || !message.includes("querySrv")) {
      throw error;
    }

    const directUri = await expandMongoSrvUri(inputUri);
    await mongoose.connect(directUri, {
      dbName,
      serverSelectionTimeoutMS: 10000,
    });

    return directUri;
  }
}

async function upsertDocument(collection, options) {
  const existing = await collection.findOne(options.filter, {
    projection: { _id: 1, createdAt: 1 },
  });

  if (existing?._id) {
    await collection.updateOne(
      { _id: existing._id },
      {
        $set: {
          ...options.document,
          updatedAt: new Date(),
        },
      }
    );

    return {
      _id: existing._id,
      created: false,
    };
  }

  const _id = options.id ?? new ObjectId();
  await collection.insertOne({
    _id,
    ...options.document,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    _id,
    created: true,
  };
}

async function main() {
  const connectedUri = await connectWithFallback(uri);

  const db = mongoose.connection.db;
  const modules = db.collection("modules");
  const lecturers = db.collection("lecturers");
  const students = db.collection("students");
  const users = db.collection("users");
  const enrollments = db.collection("enrollments");
  const moduleOfferings = db.collection("moduleofferings");
  const quizzes = db.collection("quizzes");
  const quizAttempts = db.collection("quizattempts");

  const lecturerPasswordHash = await bcrypt.hash(lecturerSeed.password, 10);
  const studentPasswordHash = await bcrypt.hash(studentSeed.password, 10);

  const moduleResult = await upsertDocument(modules, {
    filter: { code: sharedAcademic.moduleCode },
    document: {
      code: sharedAcademic.moduleCode,
      name: sharedAcademic.moduleName,
      credits: 4,
      facultyCode: sharedAcademic.facultyId,
      applicableTerms: [sharedAcademic.termCode],
      applicableDegrees: ["SE", "CS", "IT"],
      defaultSyllabusVersion: "NEW",
      outlineTemplate: [
        { weekNo: 1, title: "Introduce variables and data types", type: "LECTURE" },
        { weekNo: 7, title: "Mid-semester checkpoint", type: "MID" },
        { weekNo: 12, title: "Quiz and recap", type: "QUIZ" },
      ],
    },
  });

  const lecturerResult = await upsertDocument(lecturers, {
    filter: { email: lecturerSeed.email },
    document: {
      fullName: lecturerSeed.fullName,
      email: lecturerSeed.email,
      phone: lecturerSeed.phone,
      nicStaffId: lecturerSeed.nicStaffId,
      status: "ACTIVE",
      facultyIds: [sharedAcademic.facultyId],
      degreeProgramIds: [sharedAcademic.degreeProgramId],
      moduleIds: [sharedAcademic.moduleId, sharedAcademic.moduleCode],
      assignedOfferingIds: [],
    },
  });

  const lecturerUserResult = await upsertDocument(users, {
    filter: {
      $or: [
        { username: lecturerSeed.username },
        { email: lecturerSeed.email },
      ],
    },
    document: {
      username: lecturerSeed.username,
      email: lecturerSeed.email,
      role: "LECTURER",
      passwordHash: lecturerPasswordHash,
      mustChangePassword: false,
      status: "ACTIVE",
      studentRef: null,
      lecturerRef: lecturerResult._id,
      labAssistantRef: null,
    },
  });

  const studentResult = await upsertDocument(students, {
    filter: {
      $or: [
        { studentId: studentSeed.studentId },
        { email: studentSeed.email },
        { nicNumber: studentSeed.nicNumber },
      ],
    },
    document: {
      studentId: studentSeed.studentId,
      email: studentSeed.email,
      nicNumber: studentSeed.nicNumber,
      firstName: studentSeed.firstName,
      lastName: studentSeed.lastName,
      phone: studentSeed.phone,
      status: "ACTIVE",
    },
  });

  const studentUserResult = await upsertDocument(users, {
    filter: {
      $or: [
        { username: studentSeed.studentId },
        { email: studentSeed.email },
      ],
    },
    document: {
      username: studentSeed.studentId,
      email: studentSeed.email,
      role: "STUDENT",
      passwordHash: studentPasswordHash,
      mustChangePassword: false,
      status: "ACTIVE",
      studentRef: studentResult._id,
      lecturerRef: null,
      labAssistantRef: null,
    },
  });

  await upsertDocument(enrollments, {
    filter: {
      studentId: studentResult._id,
      degreeProgramId: sharedAcademic.degreeProgramId,
      intakeId: sharedAcademic.intakeId,
    },
    document: {
      studentId: studentResult._id,
      facultyId: sharedAcademic.facultyId,
      degreeProgramId: sharedAcademic.degreeProgramId,
      intakeId: sharedAcademic.intakeId,
      stream: "WEEKDAY",
      subgroup: "A1",
      status: "ACTIVE",
    },
  });

  const offeringResult = await upsertDocument(moduleOfferings, {
    filter: {
      intakeId: sharedAcademic.intakeId,
      termCode: sharedAcademic.termCode,
      moduleId: sharedAcademic.moduleId,
    },
    document: {
      facultyCode: sharedAcademic.facultyId,
      degreeCode: sharedAcademic.degreeProgramId,
      intakeName: sharedAcademic.intakeName,
      moduleCode: sharedAcademic.moduleCode,
      moduleName: sharedAcademic.moduleName,
      facultyId: sharedAcademic.facultyId,
      degreeProgramId: sharedAcademic.degreeProgramId,
      intakeId: sharedAcademic.intakeId,
      termCode: sharedAcademic.termCode,
      moduleId: sharedAcademic.moduleId,
      syllabusVersion: "NEW",
      assignedLecturerIds: [String(lecturerResult._id)],
      assignedLabAssistantIds: [],
      assignedLecturers: [
        {
          lecturerId: String(lecturerResult._id),
          name: lecturerSeed.fullName,
          email: lecturerSeed.email,
        },
      ],
      assignedLabAssistants: [],
      status: "ACTIVE",
      outlineWeeks: [
        {
          weekNo: 1,
          title: "Introduce variables and data types",
          type: "LECTURE",
          plannedStartDate: "2026-06-02",
          plannedEndDate: "2026-06-08",
          manuallyEdited: false,
        },
        {
          weekNo: 7,
          title: "Mid-semester checkpoint",
          type: "MID",
          plannedStartDate: "2026-07-14",
          plannedEndDate: "2026-07-20",
          manuallyEdited: false,
        },
        {
          weekNo: 12,
          title: "Quiz and recap",
          type: "QUIZ",
          plannedStartDate: "2026-08-18",
          plannedEndDate: "2026-08-24",
          manuallyEdited: false,
        },
      ],
      outlinePending: false,
      hasGrades: false,
      hasAttendance: false,
      hasContent: true,
    },
  });

  await lecturers.updateOne(
    { _id: lecturerResult._id },
    {
      $set: {
        assignedOfferingIds: [String(offeringResult._id)],
        updatedAt: new Date(),
      },
    }
  );

  const publishedQuizResult = await upsertDocument(quizzes, {
    filter: {
      createdBy: lecturerUserResult._id,
      title: "[DB Check] Variables and Control Flow",
    },
    document: {
      title: "[DB Check] Variables and Control Flow",
      description:
        "Published quiz for checking that the lecturer and student quiz pages are reading live database data.",
      moduleOfferingId: offeringResult._id,
      createdBy: lecturerUserResult._id,
      questions: [
        {
          _id: publishedQuizQuestionIds.q1,
          questionText: "Which data type stores whole numbers in Java?",
          questionType: "mcq",
          options: [
            { _id: publishedQuizQuestionIds.q1o1, optionText: "int", isCorrect: true },
            { _id: publishedQuizQuestionIds.q1o2, optionText: "String", isCorrect: false },
            { _id: publishedQuizQuestionIds.q1o3, optionText: "boolean", isCorrect: false },
          ],
          correctAnswer: "int",
          marks: 5,
          explanation: "Use int for whole-number values.",
          order: 1,
        },
        {
          _id: publishedQuizQuestionIds.q2,
          questionText: "Which statement is used to repeat a block while a condition is true?",
          questionType: "mcq",
          options: [
            { _id: publishedQuizQuestionIds.q2o1, optionText: "if", isCorrect: false },
            { _id: publishedQuizQuestionIds.q2o2, optionText: "while", isCorrect: true },
            { _id: publishedQuizQuestionIds.q2o3, optionText: "switch", isCorrect: false },
          ],
          correctAnswer: "while",
          marks: 5,
          explanation: "A while loop repeats while its condition stays true.",
          order: 2,
        },
      ],
      totalMarks: 10,
      passingMarks: 5,
      duration: 25,
      deadline: new Date("2026-05-15T12:00:00.000Z"),
      startDate: new Date("2026-04-01T08:00:00.000Z"),
      status: "published",
      maxAttempts: 2,
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: true,
      showCorrectAnswers: true,
      academicYear: "2026",
      semester: 1,
      tags: ["db-check", "available"],
    },
  });

  const closedQuizResult = await upsertDocument(quizzes, {
    filter: {
      createdBy: lecturerUserResult._id,
      title: "[DB Check] Functions and Arrays",
    },
    document: {
      title: "[DB Check] Functions and Arrays",
      description:
        "Closed quiz with one submitted attempt so both lecturer results and student completed sections show real DB data.",
      moduleOfferingId: offeringResult._id,
      createdBy: lecturerUserResult._id,
      questions: [
        {
          _id: closedQuizQuestionIds.q1,
          questionText: "What is the main purpose of a function?",
          questionType: "mcq",
          options: [
            { _id: closedQuizQuestionIds.q1o1, optionText: "To repeat CSS rules", isCorrect: false },
            { _id: closedQuizQuestionIds.q1o2, optionText: "To group reusable logic", isCorrect: true },
            { _id: closedQuizQuestionIds.q1o3, optionText: "To store images", isCorrect: false },
          ],
          correctAnswer: "To group reusable logic",
          marks: 5,
          explanation: "Functions help organize reusable logic into named blocks.",
          order: 1,
        },
        {
          _id: closedQuizQuestionIds.q2,
          questionText: "Which array index refers to the first element?",
          questionType: "mcq",
          options: [
            { _id: closedQuizQuestionIds.q2o1, optionText: "0", isCorrect: true },
            { _id: closedQuizQuestionIds.q2o2, optionText: "1", isCorrect: false },
            { _id: closedQuizQuestionIds.q2o3, optionText: "-1", isCorrect: false },
          ],
          correctAnswer: "0",
          marks: 5,
          explanation: "Arrays are zero-indexed in Java and JavaScript.",
          order: 2,
        },
      ],
      totalMarks: 10,
      passingMarks: 5,
      duration: 20,
      deadline: new Date("2026-03-29T12:00:00.000Z"),
      startDate: new Date("2026-03-20T08:00:00.000Z"),
      status: "closed",
      maxAttempts: 1,
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: true,
      showCorrectAnswers: true,
      academicYear: "2026",
      semester: 1,
      tags: ["db-check", "completed"],
    },
  });

  await upsertDocument(quizAttempts, {
    filter: {
      quizId: closedQuizResult._id,
      studentId: studentResult._id,
      attemptNumber: 1,
    },
    document: {
      quizId: closedQuizResult._id,
      studentId: studentResult._id,
      answers: [
        {
          questionId: closedQuizQuestionIds.q1,
          selectedOptionId: closedQuizQuestionIds.q1o2,
          isCorrect: true,
          marksAwarded: 5,
          questionMarks: 5,
        },
        {
          questionId: closedQuizQuestionIds.q2,
          selectedOptionId: closedQuizQuestionIds.q2o2,
          isCorrect: false,
          marksAwarded: 0,
          questionMarks: 5,
        },
      ],
      score: 5,
      totalMarks: 10,
      percentage: 50,
      passed: true,
      startedAt: new Date("2026-03-28T09:00:00.000Z"),
      submittedAt: new Date("2026-03-28T09:08:30.000Z"),
      timeTaken: 510,
      isOnTime: true,
      isWithinTimeLimit: true,
      attemptNumber: 1,
      status: "submitted",
      moduleOfferingId: offeringResult._id,
      academicYear: "2026",
      semester: 1,
      xpAwarded: 15,
      feedback: "Solid baseline. Review array indexing carefully.",
      ipAddress: "127.0.0.1",
    },
  });

  console.log("Quiz DB check seed completed.");
  console.log(`Connection mode: ${connectedUri.startsWith("mongodb+srv://") ? "mongodb+srv" : "direct mongodb"}`);
  console.log("");
  console.log("Lecturer credentials");
  console.log(`  Email: ${lecturerSeed.email}`);
  console.log(`  Username: ${lecturerSeed.username}`);
  console.log(`  Password: ${lecturerSeed.password}`);
  console.log("");
  console.log("Student credentials");
  console.log(`  Student ID: ${studentSeed.studentId}`);
  console.log(`  Email: ${studentSeed.email}`);
  console.log(`  Password: ${studentSeed.password}`);
  console.log("");
  console.log("Seeded dataset");
  console.log(`  Lecturer id: ${String(lecturerResult._id)}`);
  console.log(`  Lecturer user id: ${String(lecturerUserResult._id)}`);
  console.log(`  Student id: ${String(studentResult._id)}`);
  console.log(`  Student user id: ${String(studentUserResult._id)}`);
  console.log(`  Module offering id: ${String(offeringResult._id)}`);
  console.log(`  Published quiz id: ${String(publishedQuizResult._id)}`);
  console.log(`  Closed quiz id: ${String(closedQuizResult._id)}`);
}

main()
  .catch((error) => {
    console.error(
      `Failed to seed quiz DB check users: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => null);
  });

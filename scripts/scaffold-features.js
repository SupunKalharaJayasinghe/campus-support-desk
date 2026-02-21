const fs = require("fs");
const path = require("path");

const components = {
  "degree-programs": [
    "ProgramList",
    "ProgramCard",
    "ProgramDetails",
    "ProgramStats"
  ],
  modules: [
    "ModuleList",
    "ModuleCard",
    "ModuleLecturers",
    "ModuleWeightage",
    "ModuleStudents"
  ],
  assessments: [
    "AssessmentList",
    "AssessmentCard",
    "AssessmentDetails",
    "AssessmentSchedule",
    "QuestionBuilder",
    "QuestionList",
    "QuestionPreview",
    "SubmissionList",
    "SubmissionDetail",
    "GradingPanel",
    "FileViewer",
    "AnswerDisplay"
  ],
  quizzes: [
    "QuizList",
    "QuizCard",
    "QuizDetails",
    "QuizTaker",
    "QuestionDisplay",
    "QuizTimer",
    "QuizProgress",
    "QuizNavigation",
    "QuizSubmitConfirm",
    "QuizAttemptList",
    "QuizGrading"
  ],
  notifications: [
    "NotificationList",
    "NotificationItem",
    "NotificationFilters",
    "NotificationTargetSelector"
  ],
  "instructor-free-time": [
    "WeeklyScheduleView",
    "WeeklyScheduleEdit",
    "ExceptionList",
    "InstructorList",
    "InstructorScheduleCard",
    "ScheduleCalendar"
  ],
  "lost-items": [
    "LostItemList",
    "LostItemCard",
    "LostItemDetails",
    "LostItemFilters",
    "LostItemReview",
    "LostItemTimeline",
    "ImageGallery"
  ],
  grades: [
    "GradeTable",
    "ModuleGradeDetail",
    "GPADisplay",
    "GPAHistory",
    "TranscriptView",
    "GradeDistribution"
  ],
  users: [
    "UserList",
    "UserCard",
    "UserDetails",
    "StudentPromotion",
    "ChangeDegreeProgram",
    "StudentModuleStatus"
  ],
  groups: [
    "GroupList",
    "GroupCard",
    "GroupStudents",
    "SubGroupList",
    "GroupAssignment"
  ],
  resources: [
    "ResourceList",
    "ResourceCard",
    "ResourceUpload",
    "ResourcePreview",
    "ResourceDownload",
    "ResourceFilters"
  ],
  reports: [
    "ReportFilters",
    "StudentReport",
    "ModuleReport",
    "ProgramReport",
    "ExportOptions"
  ]
};

const baseDir = path.join("src", "components", "features");

for (const [folder, names] of Object.entries(components)) {
  for (const name of names) {
    const filePath = path.join(baseDir, folder, `${name}.tsx`);
    if (fs.existsSync(filePath)) continue;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const content = `"use client";

import { Card } from "@/components/ui/Card";

export function ${name}() {
  return (
    <Card title="${name}">
      <p className="text-sm text-slate-600">Placeholder component for ${name}.</p>
    </Card>
  );
}
`;
    fs.writeFileSync(filePath, content, "utf8");
  }
}

console.log("Feature components scaffolded.");

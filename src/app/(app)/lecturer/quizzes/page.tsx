import "../lecturer-experience.css";

import AdminQuizzesPage from "@/app/(app)/admin/quizzes/page";

export default function LecturerQuizzesPage() {
  return (
    <div className="lecturer-experience">
      <div className="page">
        <div className="section active">
          <div className="container">
            <AdminQuizzesPage />
          </div>
        </div>
      </div>
    </div>
  );
}

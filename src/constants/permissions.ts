export const rolePermissions = {
  "Super Admin": ["manage_users", "manage_programs", "view_reports"],
  "Department Admin": ["manage_programs", "view_reports"],
  Lecturer: ["manage_modules", "grade_students"],
  Student: ["view_modules", "submit_assessments"],
  "Lost Item Staff": ["manage_lost_items"]
};

export type ModuleStatus = "Active" | "Inactive" | "Draft";

export type Module = {
  id: string;
  name: string;
  code: string;
  credits: number;
  year: number;
  semester: number;
  status: ModuleStatus;
};

export type ProgramStatus = "Active" | "Inactive";

export type Program = {
  id: string;
  name: string;
  code: string;
  category: string;
  duration: number;
  students: number;
  lecturers: number;
  status: ProgramStatus;
};

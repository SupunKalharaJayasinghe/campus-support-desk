export type LecturerBookingRequest = {
  id: string;
  date: string;
  start: string;
  end: string;
  status: "Pending" | "Approved" | "Declined";
};

export const lecturerBookingRequests: LecturerBookingRequest[] = [
  {
    id: "req-001",
    date: "2026-03-02",
    start: "09:00",
    end: "09:30",
    status: "Pending",
  },
  {
    id: "req-002",
    date: "2026-03-02",
    start: "10:00",
    end: "10:30",
    status: "Approved",
  },
  {
    id: "req-003",
    date: "2026-03-03",
    start: "11:00",
    end: "11:30",
    status: "Pending",
  },
  {
    id: "req-004",
    date: "2026-03-04",
    start: "14:00",
    end: "14:30",
    status: "Approved",
  },
  {
    id: "req-005",
    date: "2026-03-05",
    start: "15:00",
    end: "15:30",
    status: "Declined",
  },
];

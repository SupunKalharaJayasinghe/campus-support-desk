import AnnouncementsPortalPage from "@/components/announcements/AnnouncementsPortalPage";

export default function StudentAnnouncementsPage() {
  return (
    <AnnouncementsPortalPage
      contained={false}
      includeTopNav={false}
      showCreateButton={false}
    />
  );
}

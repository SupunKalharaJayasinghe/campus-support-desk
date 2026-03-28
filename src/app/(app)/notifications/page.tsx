import dynamic from "next/dynamic";

const AllNotificationsPage = dynamic(
  () => import("@/components/notifications/AllNotificationsPage"),
  { ssr: false }
);

export default function NotificationsPage() {
  return <AllNotificationsPage />;
}

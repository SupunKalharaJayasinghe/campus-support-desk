import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import type { NotificationFeedItem } from "@/models/notification-center";

interface RecentNotificationsCardProps {
  title?: string;
  emptyMessage?: string;
  href: string;
  items: NotificationFeedItem[];
}

export default function RecentNotificationsCard({
  title = "Recent Notifications",
  emptyMessage = "No notifications available for your audience yet.",
  href,
  items,
}: RecentNotificationsCardProps) {
  return (
    <Card title={title}>
      {items.length === 0 ? (
        <p className="text-sm text-text/72">{emptyMessage}</p>
      ) : (
        <ul className="space-y-3">
          {items.slice(0, 3).map((item) => (
            <li className="rounded-2xl bg-tint p-3.5" key={item.id}>
              <div className="flex items-center gap-2">
                <Badge variant={item.type === "Announcement" ? "success" : "warning"}>
                  {item.type}
                </Badge>
                {!item.unread ? null : <Badge variant="danger">Unread</Badge>}
              </div>
              <p className="mt-2 text-sm font-medium text-text">{item.title}</p>
              <p className="mt-1 text-xs text-text/72">{item.time}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <Link
          className="text-sm font-medium text-primary transition-colors hover:text-primaryHover"
          href={href}
        >
          View all notifications
        </Link>
      </div>
    </Card>
  );
}

import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import type { NotificationFeedItem } from "@/models/notification-center";

interface LatestNotificationSectionProps {
  title?: string;
  subtitle?: string;
  href: string;
  item: NotificationFeedItem | null;
}

export default function LatestNotificationSection({
  title = "Latest Notification",
  subtitle = "Most recent targeted update for your account.",
  href,
  item,
}: LatestNotificationSectionProps) {
  return (
    <Card accent>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
            {title}
          </p>
          <p className="mt-1 text-sm text-text/72">{subtitle}</p>

          {item ? (
            <div className="mt-4 rounded-2xl bg-tint p-4">
              <div className="flex items-center gap-2">
                <Badge variant={item.type === "Announcement" ? "success" : "warning"}>
                  {item.type}
                </Badge>
                {item.unread ? <Badge variant="danger">Unread</Badge> : null}
              </div>
              <p className="mt-2 text-base font-semibold text-heading">{item.title}</p>
              <p className="mt-1 text-sm text-text/72">{item.message}</p>
              <p className="mt-2 text-xs text-text/60">{item.time}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-text/72">
              No notifications available for your audience.
            </p>
          )}
        </div>

        <Link
          className="inline-flex h-10 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primaryHover"
          href={href}
        >
          View Notifications
        </Link>
      </div>
    </Card>
  );
}

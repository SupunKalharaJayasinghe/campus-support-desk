"use client";

import { GroupingProvider } from "./GroupingContext";

export default function GroupsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GroupingProvider>{children}</GroupingProvider>;
}

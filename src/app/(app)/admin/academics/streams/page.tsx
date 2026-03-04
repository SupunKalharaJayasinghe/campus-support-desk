import PlaceholderPage from "@/components/admin/PlaceholderPage";

export default function StreamsPage() {
  return (
    <PlaceholderPage
      description="Define delivery streams (Weekday / Weekend) and stream-level scheduling constraints."
      highlights={[
        "Stream availability by intake/term",
        "Location constraints by stream",
        "Separate assessment calendars per stream",
      ]}
      status="Planned"
      title="Streams"
    />
  );
}


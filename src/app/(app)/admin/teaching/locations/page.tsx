import PlaceholderPage from "@/components/admin/PlaceholderPage";

export default function LocationsPage() {
  return (
    <PlaceholderPage
      description="Manage locations, labs, seat capacity, and equipment availability."
      highlights={[
        "Lab equipment inventory",
        "Capacity planning by stream",
        "Location blackout dates",
      ]}
      status="Planned"
      title="Locations / Labs"
    />
  );
}


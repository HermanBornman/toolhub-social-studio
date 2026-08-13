import { AppShell } from "@/components/AppShell";
import { CreateAdvert } from "@/components/CreateAdvert";

export default function CreateAdvertPage() {
  return (
    <AppShell title="Create Advert" subtitle="Enter the product details. The template handles the design.">
      <CreateAdvert />
    </AppShell>
  );
}


import { createFileRoute } from "@tanstack/react-router";
import DashboardLayout from "@/components/DashboardLayout";
import { getSession } from "@/lib/api";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    const session = getSession();
    if (session && !session.activeTenantId && session.tenants.length > 1) {
      window.location.replace("/select-organization");
    }
  },
  component: DashboardLayout,
});

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/sales/create")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/sales/manage" });
  },
});

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/purchases/create")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/purchases/manage" });
  },
});

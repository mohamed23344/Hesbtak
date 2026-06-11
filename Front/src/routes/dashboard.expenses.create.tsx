import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/expenses/create")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/expenses/manage" });
  },
});

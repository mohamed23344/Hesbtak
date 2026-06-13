import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/expenses/payments")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/expenses/manage" });
  },
});

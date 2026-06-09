import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, getSession, updateSession, type TenantContext } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/accept-invitation")({ component: Page });

function Page() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(true);
  const session = getSession();
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!session || !token) { setBusy(false); return; }
    void api<{ organizationId: string }>("/auth/accept-invitation", {
      method: "POST",
      body: JSON.stringify({ token }),
    }).then(async (result) => {
      const tenants = await api<TenantContext[]>("/organizations");
      updateSession({ tenants, activeTenantId: result.organizationId });
      toast.success("Invitation accepted");
      nav({ to: "/dashboard" });
    }).catch((error) => {
      toast.error(error instanceof Error ? error.message : "Could not accept invitation");
      setBusy(false);
    });
  }, []);
  if (!session) return <main className="min-h-screen grid place-items-center p-6"><div className="text-center"><h1 className="text-xl font-bold">Sign in to accept this invitation</h1><Button asChild className="mt-4"><Link to="/login">Sign in</Link></Button></div></main>;
  return <main className="min-h-screen grid place-items-center"><p>{busy ? "Accepting invitation..." : "Invitation could not be accepted."}</p></main>;
}

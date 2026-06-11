import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession, updateSession } from "@/lib/api";
import { BrandMark } from "@/components/Brand";

export const Route = createFileRoute("/select-organization")({ component: Page });

function Page() {
  const nav = useNavigate();
  const session = getSession();
  const select = (organizationId: string) => {
    updateSession({ activeTenantId: organizationId });
    nav({ to: "/dashboard" });
  };
  return <main className="min-h-screen bg-surface p-6 grid place-items-center">
    <div className="w-full max-w-3xl">
      <div className="flex justify-center mb-8"><BrandMark to="/" /></div>
      <div className="bg-card border border-border-default rounded-2xl p-6">
        <h1 className="text-2xl font-bold">Choose an organization</h1>
        <p className="text-sm text-on-surface-variant mt-1">{session?.tenants.length ? "Select the financial workspace you want to open.":"No Available Organizations. Start by adding one or get an invitation." }</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-6">
          {(session?.tenants ?? []).map((tenant) => (
            <button key={tenant.organizationId} onClick={() => select(tenant.organizationId)} className="text-start border border-border-default rounded-xl p-4 hover:border-primary">
              <Building2 className="h-5 w-5 text-primary" />
              <p className="font-semibold mt-3">{tenant.organizationName}</p>
              <p className="text-xs text-on-surface-variant capitalize">{tenant.role} · {tenant.currency}</p>
            </button>
          ))}
        </div>
        <Button className="mt-4" variant="outline" onClick={() => window.location.assign("/onboarding?new=1")}><Plus /> Create organization</Button>
      </div>
    </div>
  </main>;
}

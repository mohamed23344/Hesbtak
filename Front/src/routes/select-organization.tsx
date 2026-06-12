import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, getSession, updateSession } from "@/lib/api";
import { BrandMark } from "@/components/Brand";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/select-organization")({ component: Page });

function Page() {
  const nav = useNavigate();
  const session = getSession();
  const [notifications, setNotifications] = useState<Array<{
    id: string; title: string; message: string; createdAt: string;
  }>>([]);
  useEffect(() => {
    api<typeof notifications>("/auth/notifications")
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, []);
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
        <Button className="mt-4" variant="outline" onClick={() => nav({ to: "/onboarding", search: { newOrganization: true } })}><Plus /> Create organization</Button>
      </div>
      {notifications.length > 0 && <div className="bg-card border border-border-default rounded-2xl p-6 mt-4">
        <h2 className="font-semibold flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Account notifications</h2>
        <div className="divide-y divide-border-default mt-3">
          {notifications.slice(0, 10).map((notification) => <div key={notification.id} className="py-3">
            <p className="text-sm font-medium">{notification.title}</p>
            <p className="text-sm text-on-surface-variant mt-0.5">{notification.message}</p>
            <p className="text-xs text-on-surface-variant mt-1">{String(notification.createdAt).slice(0, 10)}</p>
          </div>)}
        </div>
      </div>}
    </div>
  </main>;
}

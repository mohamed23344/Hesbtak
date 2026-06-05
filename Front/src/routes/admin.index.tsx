import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Users, Building, ShieldAlert, BadgeCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

type AdminStats = {
  organizations: number;
  users: number;
  pendingInvitations: number;
  subscriptionsByStatus: Array<{ status: string; count: number }>;
};

function AdminDashboard() {
  const { t } = useI18n();
  const [stats, setStats] = useState<AdminStats>({
    organizations: 0,
    users: 0,
    pendingInvitations: 0,
    subscriptionsByStatus: [],
  });

  useEffect(() => {
    api<AdminStats>("/admin/dashboard")
      .then(setStats)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load admin dashboard"));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building className="h-6 w-6 text-primary" /> {t("organizations")}
        </h1>
        <p className="text-on-surface-variant mt-1">{t("manageOrgs")}</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Metric icon={Building} label={t("organizations")} value={stats.organizations} />
        <Metric icon={Users} label={t("users")} value={stats.users} />
        <Metric icon={ShieldAlert} label="Pending invitations" value={stats.pendingInvitations} />
      </div>

      <div className="bg-card border border-border-default rounded-2xl p-5 shadow-soft">
        <div className="flex items-center gap-2 text-sm font-semibold mb-4">
          <BadgeCheck className="h-4 w-4 text-primary" /> Subscription status
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(stats.subscriptionsByStatus.length ? stats.subscriptionsByStatus : [{ status: "none", count: 0 }]).map((item) => (
            <div key={item.status} className="bg-surface-subtle border border-border-default rounded-lg p-4">
              <p className="text-sm text-on-surface-variant capitalize">{item.status}</p>
              <p className="text-2xl font-bold mt-1">{item.count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="bg-card border border-border-default rounded-2xl p-5 shadow-soft">
      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center mb-3">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm text-on-surface-variant">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}

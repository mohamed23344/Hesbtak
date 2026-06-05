import { createFileRoute } from "@tanstack/react-router";
import { Header } from "./dashboard.transactions";
import { AlertTriangle, CheckCircle2, Bell } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/notifications")({ component: Page });

type Alert = {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  is_read: boolean;
  created_at: string;
};

function Page() {
  const { t } = useI18n();
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    api<Alert[]>("/tenant/alerts/evaluate", { method: "POST" })
      .then(setAlerts)
      .catch(() => api<Alert[]>("/tenant/alerts").then(setAlerts))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load notifications"));
  }, []);

  return (
    <div className="space-y-5">
      <Header title={t("notifTitle")} desc={t("notifDesc")} />
      <div className="bg-card border border-border-default rounded-2xl divide-y divide-border-default shadow-soft">
        {(alerts.length ? alerts : [{ id: "empty", title: "No notifications", message: "You are all caught up.", severity: "info", is_read: true, created_at: "" } as Alert]).map((alert) => {
          const Icon = alert.severity === "info" ? Bell : alert.is_read ? CheckCircle2 : AlertTriangle;
          return (
            <div key={alert.id} className="flex items-start gap-4 p-4 hover:bg-surface-subtle">
              <div className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${
                alert.severity === "critical" ? "bg-status-error/10 text-status-error" :
                alert.severity === "warning" ? "bg-status-warning/10 text-status-warning" :
                "bg-surface-container text-primary"
              }`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{alert.title}</p>
                <p className="text-sm text-on-surface-variant mt-0.5">{alert.message}</p>
              </div>
              <span className="text-xs text-on-surface-variant whitespace-nowrap">{alert.created_at ? String(alert.created_at).slice(0, 10) : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

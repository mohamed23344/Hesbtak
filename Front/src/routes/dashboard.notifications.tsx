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
    void Promise.allSettled([
      api<Alert[]>("/tenant/alerts/evaluate", { method: "POST" })
        .catch(() => api<Alert[]>("/tenant/alerts")),
      api<Array<{
        id: string; title: string; message: string; severity: Alert["severity"];
        isRead: boolean; createdAt: string;
      }>>("/auth/notifications"),
    ]).then((results) => {
      const tenantAlerts = results[0].status === "fulfilled" ? results[0].value : [];
      const userAlerts = results[1].status === "fulfilled"
        ? results[1].value.map((alert) => ({
            id: alert.id,
            title: alert.title,
            message: alert.message,
            severity: alert.severity,
            is_read: alert.isRead,
            created_at: alert.createdAt,
          }))
        : [];
      setAlerts([...userAlerts, ...tenantAlerts]);
      if (results.every((result) => result.status === "rejected")) {
        toast.error("Could not load notifications");
      }
      const readRequests = [];
      if (userAlerts.some((alert) => !alert.is_read)) {
        readRequests.push(api("/auth/notifications/read", { method: "POST" }));
      }
      if (tenantAlerts.some((alert) => !alert.is_read)) {
        readRequests.push(api("/tenant/alerts/read", { method: "POST" }));
      }
      if (readRequests.length > 0) {
        void Promise.allSettled(readRequests)
          .then(() => window.dispatchEvent(new Event("notifications:updated")));
      }
    });
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

import { createFileRoute } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, Download } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api, money } from "@/lib/api";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/transactions")({ component: Page });

type Entry = {
  id: string;
  date: string;
  description: string;
  status: string;
  reference_type?: string;
  lines: Array<{ debit: string; credit: string }>;
};

function Page() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    api<Entry[]>("/tenant/journal-entries")
      .then(setEntries)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load transactions"));
  }, []);

  return (
    <div className="space-y-5">
      <Header title={t("txTitle")} desc={t("txDesc")} />
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <Input placeholder={t("searchTransactions")} className="ps-9 bg-card" />
        </div>
        <Button variant="outline" size="sm" className="gap-1.5"><Filter className="h-4 w-4" /> {t("filter")}</Button>
        <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-4 w-4" /> {t("export")}</Button>
      </div>

      <div className="bg-card border border-border-default rounded-2xl overflow-hidden shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-surface-container text-on-surface-variant text-xs uppercase">
            <tr>
              <th className="text-start p-3 font-medium">{t("date")}</th>
              <th className="text-start p-3 font-medium">{t("description")}</th>
              <th className="text-start p-3 font-medium">{t("category")}</th>
              <th className="text-start p-3 font-medium">{t("status")}</th>
              <th className="text-end p-3 font-medium">{t("amount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {entries.map((entry) => {
              const amount = entry.lines.reduce((sum, line) => sum + Number(line.debit), 0);
              return (
                <tr key={entry.id} className="hover:bg-surface-subtle">
                  <td className="p-3 text-on-surface-variant">{String(entry.date).slice(0, 10)}</td>
                  <td className="p-3 font-medium">{entry.description}</td>
                  <td className="p-3 text-on-surface-variant">{entry.reference_type ?? "manual"}</td>
                  <td className="p-3"><StatusBadge status={entry.status ?? "posted"} /></td>
                  <td className="p-3 text-end font-semibold">{money(amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<string, string> = {
    completed: "bg-status-success/10 text-status-success",
    posted: "bg-status-success/10 text-status-success",
    unpaid: "bg-status-warning/10 text-status-warning",
    partial: "bg-status-warning/10 text-status-warning",
    pending: "bg-status-warning/10 text-status-warning",
    failed: "bg-status-error/10 text-status-error",
    paid: "bg-status-success/10 text-status-success",
    overdue: "bg-status-error/10 text-status-error",
    draft: "bg-surface-container text-on-surface-variant",
    received: "bg-status-warning/10 text-status-warning",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-surface-container"}`}>
      {t(status as any) || status}
    </span>
  );
}

export function Header({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {desc && <p className="text-sm text-on-surface-variant">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

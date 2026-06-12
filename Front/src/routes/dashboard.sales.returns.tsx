import { createFileRoute } from "@tanstack/react-router";
import { Header, StatusBadge } from "./dashboard.transactions";
import { useI18n } from "@/lib/i18n";
import { api, money } from "@/lib/api";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/sales/returns")({ component: SalesReturns });

type Return = {
  id: string;
  return_number: string;
  invoice_id: string;
  customer_id: string;
  return_date: string;
  reason: string;
  total: string;
  status: string;
};

function SalesReturns() {
  const { t } = useI18n();
  const [returns, setReturns] = useState<Return[]>([]);

  const load = async () => {
    try {
      setReturns(await api<Return[]>("/tenant/sales-returns"));
    } catch {
      setReturns([]);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-5">
      <Header title={t("returns")} desc={t("salesDesc")} />

      <div className="bg-card border border-border-default rounded-2xl overflow-hidden shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-surface-container text-on-surface-variant text-xs uppercase">
            <tr>
              <th className="text-start p-3 font-medium">Return #</th>
              <th className="text-start p-3 font-medium">{t("date")}</th>
              <th className="text-start p-3 font-medium">Reason</th>
              <th className="text-start p-3 font-medium">{t("status")}</th>
              <th className="text-end p-3 font-medium">{t("amount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {returns.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-on-surface-variant text-sm">No sales returns yet.</td></tr>
            ) : (
              returns.map((r) => (
                <tr key={r.id} className="hover:bg-surface-subtle">
                  <td className="p-3 font-medium text-primary">{r.return_number}</td>
                  <td className="p-3 text-on-surface-variant">{String(r.return_date).slice(0, 10)}</td>
                  <td className="p-3 text-on-surface-variant">{r.reason}</td>
                  <td className="p-3"><StatusBadge status={r.status} /></td>
                  <td className="p-3 text-end font-semibold">{money(r.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

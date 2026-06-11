import { createFileRoute } from "@tanstack/react-router";
import { Header } from "./dashboard.transactions";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/expenses/vendors")({ component: ExpenseVendors });

type Vendor = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

function ExpenseVendors() {
  const { t } = useI18n();
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const load = async () => {
    try {
      setVendors(await api<Vendor[]>("/tenant/vendors"));
    } catch {
      toast.error("Could not load vendors");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-5">
      <Header title={t("vendors")} desc={t("expensesDesc")} />

      <div className="bg-card border border-border-default rounded-2xl overflow-hidden shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-surface-container text-on-surface-variant text-xs uppercase">
            <tr>
              <th className="text-start p-3 font-medium">{t("fullName")}</th>
              <th className="text-start p-3 font-medium">{t("email")}</th>
              <th className="text-start p-3 font-medium">Phone</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {vendors.length === 0 ? (
              <tr><td colSpan={3} className="p-8 text-center text-on-surface-variant text-sm">No vendors yet.</td></tr>
            ) : (
              vendors.map((v) => (
                <tr key={v.id} className="hover:bg-surface-subtle">
                  <td className="p-3 font-medium">{v.name}</td>
                  <td className="p-3 text-on-surface-variant">{v.email || "—"}</td>
                  <td className="p-3 text-on-surface-variant">{v.phone || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

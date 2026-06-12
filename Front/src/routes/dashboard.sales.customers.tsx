import { createFileRoute } from "@tanstack/react-router";
import { Header } from "./dashboard.transactions";

import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/sales/customers")({ component: CustomersPage });

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

function CustomersPage() {
  const { t } = useI18n();
  const [customers, setCustomers] = useState<Customer[]>([]);

  const load = async () => {
    try {
      setCustomers(await api<Customer[]>("/tenant/customers"));
    } catch {
      toast.error("Could not load customers");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-5">
      <Header title={t("customers")} desc={t("salesDesc")} />

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
            {customers.length === 0 ? (
              <tr><td colSpan={3} className="p-8 text-center text-on-surface-variant text-sm">No customers yet.</td></tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="hover:bg-surface-subtle">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3 text-on-surface-variant">{c.email || "—"}</td>
                  <td className="p-3 text-on-surface-variant">{c.phone || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

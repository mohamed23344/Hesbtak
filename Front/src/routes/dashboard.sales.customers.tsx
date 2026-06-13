import { createFileRoute } from "@tanstack/react-router";
import { Header, StatusBadge } from "./dashboard.transactions";
import { useI18n } from "@/lib/i18n";
import { api, money } from "@/lib/api";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/dashboard/sales/customers")({ component: CustomersPage });

type Customer = { id: string; name: string; email: string; phone: string };
type Activity = {
  invoices: Array<{ id: string; invoice_number: string; issue_date: string; status: string; total: string; paid_amount: string }>;
  payments: Array<{ id: string; invoice_number?: string; payment_date: string; payment_method: string; amount: string }>;
};

function CustomersPage() {
  const { t } = useI18n();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);

  useEffect(() => {
    void api<Customer[]>("/tenant/customers")
      .then(setCustomers)
      .catch(() => toast.error("Could not load customers"));
  }, []);

  const viewActivity = async (customer: Customer) => {
    setSelected(customer);
    setActivity(null);
    try {
      setActivity(await api<Activity>(`/tenant/customers/${customer.id}/activity`));
    } catch {
      toast.error("Could not load customer activity");
    }
  };

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
              <th className="w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {customers.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-on-surface-variant text-sm">No customers yet.</td></tr>
            ) : customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-surface-subtle">
                <td className="p-3 font-medium">{customer.name}</td>
                <td className="p-3 text-on-surface-variant">{customer.email || "—"}</td>
                <td className="p-3 text-on-surface-variant">{customer.phone || "—"}</td>
                <td className="p-3"><Button size="sm" variant="outline" onClick={() => void viewActivity(customer)}>View</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selected?.name} activity</DialogTitle></DialogHeader>
          {!activity ? <p className="py-8 text-center text-sm text-on-surface-variant">Loading...</p> : (
            <div className="space-y-6">
              <ActivityTable
                title="Invoices"
                headers={["Invoice", "Date", "Status", "Total", "Paid"]}
                rows={activity.invoices.map((invoice) => [
                  invoice.invoice_number,
                  String(invoice.issue_date).slice(0, 10),
                  <StatusBadge key="status" status={invoice.status} />,
                  money(invoice.total),
                  money(invoice.paid_amount),
                ])}
              />
              <ActivityTable
                title="Payments"
                headers={["Invoice", "Date", "Method", "Amount"]}
                rows={activity.payments.map((payment) => [
                  payment.invoice_number || "—",
                  String(payment.payment_date).slice(0, 10),
                  payment.payment_method,
                  money(payment.amount),
                ])}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActivityTable({ title, headers, rows }: { title: string; headers: string[]; rows: ReactNode[][] }) {
  return (
    <section>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <div className="overflow-hidden rounded-xl border border-border-default">
        <table className="w-full text-sm">
          <thead className="bg-surface-container text-xs uppercase text-on-surface-variant">
            <tr>{headers.map((header) => <th key={header} className="p-3 text-start">{header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {rows.length ? rows.map((row, index) => (
              <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="p-3">{cell}</td>)}</tr>
            )) : <tr><td colSpan={headers.length} className="p-6 text-center text-on-surface-variant">No records.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

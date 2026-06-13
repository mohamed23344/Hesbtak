import { createFileRoute } from "@tanstack/react-router";
import { Header, StatusBadge } from "./dashboard.transactions";
import { useI18n } from "@/lib/i18n";
import { api, money } from "@/lib/api";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/dashboard/purchases/vendors")({ component: VendorsPage });

type Vendor = { id: string; name: string; email: string; phone: string };
type Activity = {
  bills: Array<{ id: string; bill_number: string; issue_date: string; status: string; total: string; paid_amount: string }>;
  payments: Array<{ id: string; bill_number?: string; payment_date: string; payment_method: string; amount: string }>;
};

function VendorsPage() {
  const { t } = useI18n();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selected, setSelected] = useState<Vendor | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);

  useEffect(() => {
    void api<Vendor[]>("/tenant/vendors")
      .then(setVendors)
      .catch(() => toast.error("Could not load vendors"));
  }, []);

  const viewActivity = async (vendor: Vendor) => {
    setSelected(vendor);
    setActivity(null);
    try {
      setActivity(await api<Activity>(`/tenant/vendors/${vendor.id}/activity`));
    } catch {
      toast.error("Could not load vendor activity");
    }
  };

  return (
    <div className="space-y-5">
      <Header title={t("vendors")} desc={t("purchasesDesc")} />
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
            {vendors.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-on-surface-variant text-sm">No vendors yet.</td></tr>
            ) : vendors.map((vendor) => (
              <tr key={vendor.id} className="hover:bg-surface-subtle">
                <td className="p-3 font-medium">{vendor.name}</td>
                <td className="p-3 text-on-surface-variant">{vendor.email || "—"}</td>
                <td className="p-3 text-on-surface-variant">{vendor.phone || "—"}</td>
                <td className="p-3"><Button size="sm" variant="outline" onClick={() => void viewActivity(vendor)}>View</Button></td>
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
                title="Purchase bills"
                headers={["Bill", "Date", "Status", "Total", "Paid"]}
                rows={activity.bills.map((bill) => [
                  bill.bill_number,
                  String(bill.issue_date).slice(0, 10),
                  <StatusBadge key="status" status={bill.status} />,
                  money(bill.total),
                  money(bill.paid_amount),
                ])}
              />
              <ActivityTable
                title="Payments"
                headers={["Bill", "Date", "Method", "Amount"]}
                rows={activity.payments.map((payment) => [
                  payment.bill_number || "—",
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

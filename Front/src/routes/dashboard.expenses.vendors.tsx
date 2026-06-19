import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Header, StatusBadge } from "./dashboard.transactions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, money } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/expenses/vendors")({ component: ExpenseVendorsPage });

type Vendor = { id: string; name: string; email?: string; phone?: string };
type ExpenseBill = {
  id: string;
  bill_number: string;
  issue_date: string;
  status: string;
  total: string;
  paid_amount: string;
};

function ExpenseVendorsPage() {
  const { l } = useI18n();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selected, setSelected] = useState<Vendor | null>(null);
  const [bills, setBills] = useState<ExpenseBill[] | null>(null);

  useEffect(() => {
    void api<Vendor[]>("/tenant/vendors?billType=expense")
      .then(setVendors)
      .catch(() => toast.error(l("Could not load expense vendors")));
  }, []);

  const viewExpenses = async (vendor: Vendor) => {
    setSelected(vendor);
    setBills(null);
    try {
      const activity = await api<{ bills: ExpenseBill[] }>(
        `/tenant/vendors/${vendor.id}/activity?billType=expense`,
      );
      setBills(activity.bills);
    } catch {
      toast.error(l("Could not load vendor expenses"));
    }
  };

  return (
    <div className="space-y-5">
      <Header title={l("Expense Vendors")} desc={l("Vendors used on expense bills only.")} />
      <div className="overflow-hidden rounded-2xl border border-border-default bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-surface-container text-xs uppercase text-on-surface-variant">
            <tr>
              <th className="p-3 text-start font-medium">{l("Vendor")}</th>
              <th className="p-3 text-start font-medium">{l("Email")}</th>
              <th className="p-3 text-start font-medium">{l("Phone")}</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {vendors.length ? vendors.map((vendor) => (
              <tr key={vendor.id} className="hover:bg-surface-subtle">
                <td className="p-3 font-medium">{vendor.name}</td>
                <td className="p-3 text-on-surface-variant">{vendor.email || "-"}</td>
                <td className="p-3 text-on-surface-variant">{vendor.phone || "-"}</td>
                <td className="p-3">
                  <Button size="sm" variant="outline" onClick={() => void viewExpenses(vendor)}>{l("View")}</Button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={4} className="p-8 text-center text-on-surface-variant">{l("No vendors are linked to expense bills.")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selected?.name} — {l("expense bills")}</DialogTitle></DialogHeader>
          {!bills ? <p className="py-8 text-center text-sm text-on-surface-variant">{l("Loading...")}</p> : (
            <div className="overflow-hidden rounded-xl border border-border-default">
              <table className="w-full text-sm">
                <thead className="bg-surface-container text-xs uppercase text-on-surface-variant">
                  <tr>
                    {["Bill", "Date", "Status", "Total", "Paid"].map((header) => (
                      <th key={header} className="p-3 text-start">{l(header)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {bills.length ? bills.map((bill) => (
                    <tr key={bill.id}>
                      <td className="p-3">{bill.bill_number}</td>
                      <td className="p-3">{String(bill.issue_date).slice(0, 10)}</td>
                      <td className="p-3"><StatusBadge status={bill.status} /></td>
                      <td className="p-3">{money(bill.total)}</td>
                      <td className="p-3">{money(bill.paid_amount)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="p-6 text-center text-on-surface-variant">{l("No expense bills.")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

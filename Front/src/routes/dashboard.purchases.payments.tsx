import { createFileRoute } from "@tanstack/react-router";
import { Header } from "./dashboard.transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api, money } from "@/lib/api";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/purchases/payments")({ component: PurchasePayments });

type Payment = {
  id: string;
  vendor_bill_id: string;
  vendor_id: string;
  amount: string;
  payment_date: string;
  payment_method: string;
  reference: string;
  vendor_name: string;
  bill_number: string;
};

type Vendor = { id: string; name: string; email?: string };
type Bill = { id: string; bill_number: string; total: string; vendor_name?: string; status: string; vendor_id: string };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function PurchasePayments() {
  const { t } = useI18n();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [open, setOpen] = useState(false);
  const [partySearch, setPartySearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");

  const [form, setForm] = useState({
    vendorId: "",
    billId: "",
    amount: "",
    paymentDate: today(),
    paymentMethod: "cash",
    notes: "",
  });

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const load = async () => {
    try {
      setPayments(await api<Payment[]>("/tenant/vendor-payments"));
    } catch {
      setPayments([]);
    }
  };

  const loadVendorsAndBills = async () => {
    try {
      setVendors(await api<Vendor[]>("/tenant/vendors"));
      setBills(await api<Bill[]>("/tenant/vendor-bills/unpaid"));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredVendors = vendors.filter(
    (v) => v.name.toLowerCase().includes(partySearch.toLowerCase()) || v.email?.toLowerCase().includes(partySearch.toLowerCase()),
  );
  const filteredPayments = payments.filter((payment) =>
    `${payment.vendor_name} ${payment.bill_number ?? ""}`
      .toLowerCase()
      .includes(paymentSearch.toLowerCase()),
  );

  const vendorBills = bills.filter((b) => !form.vendorId || b.vendor_id === form.vendorId);

  const submit = async () => {
    try {
      await api("/tenant/vendor-payments", {
        method: "POST",
        body: JSON.stringify({
          partyId: form.vendorId,
          partyType: "vendor",
          entityId: form.billId || undefined,
          amount: Number(form.amount),
          paymentMethod: form.paymentMethod,
          paymentDate: form.paymentDate,
          notes: form.notes || undefined,
        }),
      });
      toast.success("Payment recorded");
      setOpen(false);
      setForm({ vendorId: "", billId: "", amount: "", paymentDate: today(), paymentMethod: "cash", notes: "" });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record payment");
    }
  };

  return (
    <div className="space-y-5">
      <Header
        title={t("payments")}
        desc={t("purchasesDesc")}
        action={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) loadVendorsAndBills(); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary gap-1.5"><Plus className="h-4 w-4" /> Record Payment</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Record Vendor Payment</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Vendor</Label>
                  <div className="relative">
                    <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <Input className="ps-9" placeholder="Search vendor..." value={partySearch} onChange={(e) => setPartySearch(e.target.value)} />
                  </div>
                  <div className="max-h-32 overflow-y-auto border border-border-default rounded-lg divide-y">
                    {filteredVendors.map((v) => (
                      <button
                        key={v.id}
                        className={`w-full text-start p-2 text-sm hover:bg-surface-subtle ${form.vendorId === v.id ? "bg-primary/10" : ""}`}
                        onClick={() => { setForm((prev) => ({ ...prev, vendorId: v.id })); setPartySearch(""); }}
                      >
                        {v.name}
                      </button>
                    ))}
                  </div>
                </div>

                {form.vendorId && (
                  <div className="space-y-1.5">
                    <Label>Bill (optional - select to pay specific bill)</Label>
                    <select value={form.billId} onChange={update("billId")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">Auto-pay oldest unpaid bill</option>
                      {vendorBills.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bill_number} - {money(b.total)} ({b.status})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>{t("amount")}</Label>
                  <Input value={form.amount} onChange={update("amount")} type="number" placeholder="0.00" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("date")}</Label>
                    <Input value={form.paymentDate} onChange={update("paymentDate")} type="date" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Method</Label>
                    <select value={form.paymentMethod} onChange={update("paymentMethod")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="cash">Cash</option>
                      <option value="bank">Bank</option>
                      <option value="card">Card</option>
                      <option value="transfer">Transfer</option>
                    </select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                <Button className="bg-gradient-primary" onClick={submit} disabled={!form.vendorId || !form.amount}>Record</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <Input className="ps-9 bg-card" placeholder="Filter by vendor name..." value={paymentSearch} onChange={(event) => setPaymentSearch(event.target.value)} />
      </div>

      <div className="bg-card border border-border-default rounded-2xl overflow-hidden shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-surface-container text-on-surface-variant text-xs uppercase">
            <tr>
              <th className="text-start p-3 font-medium">{t("date")}</th>
              <th className="text-start p-3 font-medium">Bill</th>
              <th className="text-start p-3 font-medium">Vendor</th>
              <th className="text-start p-3 font-medium">Method</th>
              <th className="text-end p-3 font-medium">{t("amount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {filteredPayments.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-on-surface-variant text-sm">No payments found.</td></tr>
            ) : (
              filteredPayments.map((p) => (
                <tr key={p.id} className="hover:bg-surface-subtle">
                  <td className="p-3">{String(p.payment_date).slice(0, 10)}</td>
                  <td className="p-3 text-on-surface-variant">{p.bill_number || p.vendor_bill_id?.slice(0, 8) || "—"}</td>
                  <td className="p-3">{p.vendor_name}</td>
                  <td className="p-3 text-on-surface-variant">{p.payment_method}</td>
                  <td className="p-3 text-end font-semibold">{money(p.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

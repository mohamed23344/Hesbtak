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

export const Route = createFileRoute("/dashboard/sales/payments")({ component: SalesPayments });

type Payment = {
  id: string;
  customer_id: string;
  invoice_id: string;
  amount: string;
  payment_date: string;
  payment_method: string;
  reference: string;
  customer_name: string;
  invoice_number: string;
};

type Customer = { id: string; name: string; email?: string };
type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string;
  total: string;
  paid_amount?: string;
  remaining_amount?: string;
  customer_name?: string;
  status: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function SalesPayments() {
  const { t, l } = useI18n();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [open, setOpen] = useState(false);
  const [partySearch, setPartySearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");

  const [form, setForm] = useState({
    customerId: "",
    invoiceId: "",
    amount: "",
    paymentDate: today(),
    paymentMethod: "cash",
    notes: "",
  });

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const load = async () => {
    try {
      setPayments(await api<Payment[]>("/tenant/customer-payments"));
    } catch {
      setPayments([]);
    }
  };

  const loadCustomersAndInvoices = async () => {
    try {
      setCustomers(await api<Customer[]>("/tenant/customers"));
      setInvoices(await api<Invoice[]>("/tenant/invoices/unpaid"));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredCustomers = customers.filter(
    (c) => c.name.toLowerCase().includes(partySearch.toLowerCase()) || c.email?.toLowerCase().includes(partySearch.toLowerCase()),
  );
  const filteredPayments = payments.filter((payment) =>
    `${payment.customer_name} ${payment.invoice_number ?? ""}`
      .toLowerCase()
      .includes(paymentSearch.toLowerCase()),
  );

  const customerInvoices = invoices.filter((inv) => !form.customerId || inv.customer_id === form.customerId);
  const selectedInvoice = invoices.find((invoice) => invoice.id === form.invoiceId);
  const selectedInvoiceRemaining = Number(selectedInvoice?.remaining_amount ?? selectedInvoice?.total ?? 0);

  const submit = async () => {
    try {
      await api("/tenant/customer-payments", {
        method: "POST",
        body: JSON.stringify({
          partyId: form.customerId,
          partyType: "customer",
          entityId: form.invoiceId || undefined,
          amount: Number(form.amount),
          paymentMethod: form.paymentMethod,
          paymentDate: form.paymentDate,
          notes: form.notes || undefined,
        }),
      });
      toast.success("Payment recorded");
      setOpen(false);
      setForm({ customerId: "", invoiceId: "", amount: "", paymentDate: today(), paymentMethod: "cash", notes: "" });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record payment");
    }
  };

  return (
    <div className="space-y-5">
      <Header
        title={t("payments")}
        desc={t("salesDesc")}
        action={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) loadCustomersAndInvoices(); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary gap-1.5"><Plus className="h-4 w-4" /> {l("Record Payment")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{l("Record Customer Payment")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>{l("Customer")}</Label>
                  <div className="relative">
                    <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <Input className="ps-9" placeholder={l("Search customer...")} value={partySearch} onChange={(e) => setPartySearch(e.target.value)} />
                  </div>
                  <div className="max-h-32 overflow-y-auto border border-border-default rounded-lg divide-y">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        className={`w-full text-start p-2 text-sm hover:bg-surface-subtle ${form.customerId === c.id ? "bg-primary/10" : ""}`}
                        onClick={() => { setForm((prev) => ({ ...prev, customerId: c.id })); setPartySearch(""); }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                {form.customerId && (
                  <div className="space-y-1.5">
                    <Label>{l("Invoice (optional - select to pay specific invoice)")}</Label>
                    <select value={form.invoiceId} onChange={update("invoiceId")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">{t("autoPayOldest")}</option>
                      {customerInvoices.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoice_number} - {money(inv.remaining_amount ?? inv.total)} left ({inv.status})
                        </option>
                      ))}
                    </select>
                    {selectedInvoice && (
                      <p className="text-xs text-on-surface-variant">
                        {l("Left amount")}: <span className="font-semibold text-on-surface">{money(selectedInvoiceRemaining)}</span>
                        {selectedInvoice.status === "partial" && selectedInvoice.paid_amount
                          ? ` after ${money(selectedInvoice.paid_amount)} already paid`
                          : ""}
                      </p>
                    )}
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
                    <Label>{t("paymentMethod")}</Label>
                    <select value={form.paymentMethod} onChange={update("paymentMethod")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="cash">{l("Cash")}</option>
                      <option value="bank">{l("Bank")}</option>
                      <option value="card">{l("Card")}</option>
                      <option value="transfer">{l("Transfer")}</option>
                    </select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                <Button className="bg-gradient-primary" onClick={submit} disabled={!form.customerId || !form.amount}>{l("Record")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <Input className="ps-9 bg-card" placeholder={l("Filter by customer name...")} value={paymentSearch} onChange={(event) => setPaymentSearch(event.target.value)} />
      </div>

      <div className="bg-card border border-border-default rounded-2xl overflow-hidden shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-surface-container text-on-surface-variant text-xs uppercase">
            <tr>
              <th className="text-start p-3 font-medium">{t("date")}</th>
              <th className="text-start p-3 font-medium">{t("invoices")}</th>
              <th className="text-start p-3 font-medium">{l("Customer")}</th>
              <th className="text-start p-3 font-medium">{t("paymentMethod")}</th>
              <th className="text-end p-3 font-medium">{t("amount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {filteredPayments.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-on-surface-variant text-sm">{l("No payments found.")}</td></tr>
            ) : (
              filteredPayments.map((p) => (
                <tr key={p.id} className="hover:bg-surface-subtle">
                  <td className="p-3">{String(p.payment_date).slice(0, 10)}</td>
                  <td className="p-3 text-on-surface-variant">{p.invoice_number || p.invoice_id?.slice(0, 8) || "—"}</td>
                  <td className="p-3">{p.customer_name}</td>
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

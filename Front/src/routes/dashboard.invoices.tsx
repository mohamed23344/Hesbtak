import { createFileRoute } from "@tanstack/react-router";
import { Header, StatusBadge } from "./dashboard.transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { api, money } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/invoices")({ component: Page });

type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string;
  issue_date: string;
  due_date: string;
  total: string;
  status: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function Page() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [form, setForm] = useState({
    client: "",
    email: "",
    issueDate: today(),
    dueDate: today(),
    description: "",
    quantity: "1",
    unitPrice: "",
  });

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: e.target.value }));

  const load = async () => {
    try {
      setInvoices(await api<Invoice[]>("/tenant/invoices"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load invoices");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const outstanding = invoices
      .filter((i) => ["unpaid", "partial", "overdue"].includes(i.status))
      .reduce((sum, i) => sum + Number(i.total), 0);
    const paid = invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + Number(i.total), 0);
    return { outstanding, paid, overdue: invoices.filter((i) => i.status === "overdue").length, drafts: invoices.filter((i) => i.status === "draft").length };
  }, [invoices]);

  const submit = async () => {
    try {
      const customer = await api<{ id: string }>("/tenant/customers", {
        method: "POST",
        body: JSON.stringify({ name: form.client, email: form.email || undefined }),
      });
      await api("/tenant/invoices", {
        method: "POST",
        body: JSON.stringify({
          customerId: customer.id,
          issueDate: form.issueDate,
          dueDate: form.dueDate,
          lines: [
            {
              description: form.description || "Service",
              quantity: Number(form.quantity || 1),
              unitPrice: Number(form.unitPrice || 0),
            },
          ],
        }),
      });
      toast.success("Invoice created");
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create invoice");
    }
  };

  return (
    <div className="space-y-5">
      <Header
        title={t("invTitle")}
        desc={t("invDesc")}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary gap-1.5"><Plus className="h-4 w-4" /> {t("newInvoice")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{t("createInvoice")}</DialogTitle></DialogHeader>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>{t("client")}</Label><Input value={form.client} onChange={update("client")} placeholder="Client name" /></div>
                <div className="space-y-1.5"><Label>{t("email")}</Label><Input value={form.email} onChange={update("email")} type="email" placeholder="client@email.com" /></div>
                <div className="space-y-1.5"><Label>{t("issueDate")}</Label><Input value={form.issueDate} onChange={update("issueDate")} type="date" /></div>
                <div className="space-y-1.5"><Label>{t("dueDate")}</Label><Input value={form.dueDate} onChange={update("dueDate")} type="date" /></div>
              </div>
              <div className="mt-4 space-y-1.5">
                <Label>{t("itemDescription")}</Label>
                <div className="flex gap-2">
                  <Input value={form.description} onChange={update("description")} placeholder="Service" className="flex-1" />
                  <Input value={form.quantity} onChange={update("quantity")} type="number" placeholder="Qty" className="w-24" />
                  <Input value={form.unitPrice} onChange={update("unitPrice")} type="number" placeholder="Price" className="w-32" />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                <Button className="bg-gradient-primary" onClick={submit}>{t("sendInvoice")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid sm:grid-cols-4 gap-4">
        {[
          { l: t("outstanding"), v: money(stats.outstanding) },
          { l: t("paid30d"), v: money(stats.paid) },
          { l: t("overdue"), v: String(stats.overdue), alert: true },
          { l: t("drafts"), v: String(stats.drafts) },
        ].map((s) => (
          <div key={s.l} className="bg-card border border-border-default rounded-2xl p-5">
            <p className="text-sm text-on-surface-variant">{s.l}</p>
            <p className={`text-2xl font-bold mt-2 ${s.alert ? "text-status-error" : ""}`}>{s.v}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border-default rounded-2xl overflow-hidden shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-surface-container text-on-surface-variant text-xs uppercase">
            <tr>
              <th className="text-start p-3 font-medium">{t("number")}</th>
              <th className="text-start p-3 font-medium">{t("issued")}</th>
              <th className="text-start p-3 font-medium">{t("dueDate")}</th>
              <th className="text-start p-3 font-medium">{t("status")}</th>
              <th className="text-end p-3 font-medium">{t("amount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {invoices.map((i) => (
              <tr key={i.id} className="hover:bg-surface-subtle cursor-pointer">
                <td className="p-3 font-medium text-primary">{i.invoice_number}</td>
                <td className="p-3 text-on-surface-variant">{String(i.issue_date).slice(0, 10)}</td>
                <td className="p-3 text-on-surface-variant">{String(i.due_date).slice(0, 10)}</td>
                <td className="p-3"><StatusBadge status={i.status} /></td>
                <td className="p-3 text-end font-semibold">{money(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

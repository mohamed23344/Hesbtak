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

export const Route = createFileRoute("/dashboard/expenses")({ component: Page });

const CATS = ["Salaries", "Rent", "Software", "Marketing", "Utilities", "Travel", "Other"];

type Expense = {
  id: string;
  expense_number: string;
  expense_date: string;
  category?: string;
  description: string;
  amount: string;
  total: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function Page() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState({
    vendor: "",
    amount: "",
    category: "Software",
    date: today(),
    notes: "",
  });

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [key]: e.target.value }));

  const load = async () => {
    try {
      setExpenses(await api<Expense[]>("/tenant/expenses"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load expenses");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const total = useMemo(() => expenses.reduce((sum, e) => sum + Number(e.total), 0), [expenses]);

  const submit = async () => {
    try {
      await api("/tenant/expenses", {
        method: "POST",
        body: JSON.stringify({
          expenseDate: form.date,
          category: form.category,
          description: form.notes || form.vendor || form.category,
          amount: Number(form.amount || 0),
          paymentMethod: "cash",
        }),
      });
      toast.success("Expense saved");
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save expense");
    }
  };

  return (
    <div className="space-y-5">
      <Header
        title={t("expTitle")}
        desc={t("expDesc")}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary gap-1.5"><Plus className="h-4 w-4" /> {t("addExpense")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("newExpense")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>{t("vendor")}</Label><Input value={form.vendor} onChange={update("vendor")} placeholder="e.g. AWS" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>{t("amount")}</Label><Input value={form.amount} onChange={update("amount")} type="number" placeholder="0.00" /></div>
                  <div className="space-y-1.5">
                    <Label>{t("category")}</Label>
                    <select value={form.category} onChange={update("category")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                      {CATS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5"><Label>{t("date")}</Label><Input value={form.date} onChange={update("date")} type="date" /></div>
                <div className="space-y-1.5"><Label>{t("notes")}</Label><Input value={form.notes} onChange={update("notes")} placeholder={t("optional")} /></div>
              </div>
              <DialogFooter><Button className="bg-gradient-primary" onClick={submit}>{t("saveExpense")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { l: t("totalThisMonth"), v: money(total) },
          { l: t("pendingApproval"), v: money(0) },
          { l: t("avgPerWeek"), v: money(total / 4) },
        ].map((s) => (
          <div key={s.l} className="bg-card border border-border-default rounded-2xl p-5">
            <p className="text-sm text-on-surface-variant">{s.l}</p>
            <p className="text-2xl font-bold mt-2">{s.v}</p>
          </div>
        ))}
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
            {expenses.map((e) => (
              <tr key={e.id} className="hover:bg-surface-subtle">
                <td className="p-3 text-on-surface-variant">{String(e.expense_date).slice(0, 10)}</td>
                <td className="p-3 font-medium">{e.description}</td>
                <td className="p-3">{e.category ?? "-"}</td>
                <td className="p-3"><StatusBadge status="completed" /></td>
                <td className="p-3 text-end font-semibold">{money(e.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

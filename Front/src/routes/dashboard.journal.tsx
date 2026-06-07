import { createFileRoute } from "@tanstack/react-router";
import { Header } from "./dashboard.transactions";
import { useI18n } from "@/lib/i18n";
import { api, money } from "@/lib/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Trash2, FileText, Search, AlertCircle, CheckCircle2, ChevronDown, X,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/journal")({ component: Page });

/* ─── Types ─────────────────────────────────────────────────── */
type Account = { id: string; code: string; name: string; type: string };
type Customer = { id: string; name: string; email?: string };

type JournalLine = { id: string; account_id: string; debit: string; credit: string; description?: string };
type JournalEntry = { id: string; date: string; description: string; reference_type?: string; status?: string; lines: JournalLine[] };

type NewLine = { accountId: string; accountName: string; debit: string; credit: string; description: string };

/* ─── Utility ───────────────────────────────────────────────── */
function today() { return new Date().toISOString().slice(0, 10); }
function uid() { return Math.random().toString(36).slice(2); }

/* ─── Account Combobox ───────────────────────────────────────── */
function AccountCombobox({
  accounts, value, onChange, onQuickAdd,
}: {
  accounts: Account[];
  value: string;
  onChange: (id: string, name: string) => void;
  onQuickAdd: (typedName: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(
    () => accounts.filter((a) =>
      `${a.code} ${a.name}`.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10),
    [accounts, query]
  );

  const select = (a: Account) => {
    setQuery(`${a.code} – ${a.name}`);
    onChange(a.id, a.name);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative w-full">
      <div className="relative">
        <Search className="h-3.5 w-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search accounts…"
          className="ps-7 h-8 text-xs"
        />
        {query && (
          <button onClick={() => { setQuery(""); onChange("", ""); setOpen(false); }}
            className="absolute end-2 top-1/2 -translate-y-1/2 text-on-surface-variant">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border-default rounded-lg shadow-card overflow-hidden">
          {filtered.length > 0 ? (
            <ul className="max-h-44 overflow-y-auto divide-y divide-border-default">
              {filtered.map((a) => (
                <li
                  key={a.id}
                  onMouseDown={() => select(a)}
                  className="px-3 py-2 text-xs hover:bg-surface-container cursor-pointer flex items-center gap-2"
                >
                  <span className="text-on-surface-variant font-mono w-12 shrink-0">{a.code}</span>
                  <span>{a.name}</span>
                  <span className="ms-auto text-on-surface-variant text-[10px] bg-surface-container px-1.5 py-0.5 rounded">{a.type}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-3 text-xs text-on-surface-variant flex flex-col gap-2">
              <span className="flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> No account found</span>
              {query && (
                <button
                  onMouseDown={() => { setOpen(false); onQuickAdd(query); }}
                  className="text-primary font-medium hover:underline text-start"
                >
                  + Quick add "{query}"
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Customer Combobox ─────────────────────────────────────── */
function CustomerCombobox({
  customers, value, onChange, onQuickAdd,
}: {
  customers: Customer[];
  value: string;
  onChange: (id: string, name: string) => void;
  onQuickAdd: (name: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(
    () => customers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8),
    [customers, query]
  );

  const select = (c: Customer) => {
    setQuery(c.name);
    onChange(c.id, c.name);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative w-full">
      <div className="relative">
        <Search className="h-3.5 w-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search customers…"
          className="ps-7 text-sm"
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border-default rounded-lg shadow-card overflow-hidden">
          {filtered.length > 0 ? (
            <ul className="max-h-40 overflow-y-auto divide-y divide-border-default">
              {filtered.map((c) => (
                <li key={c.id} onMouseDown={() => select(c)}
                  className="px-3 py-2 text-sm hover:bg-surface-container cursor-pointer">
                  {c.name}
                  {c.email && <span className="text-xs text-on-surface-variant ms-2">{c.email}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-3 text-xs text-on-surface-variant flex flex-col gap-2">
              <span>No customer found.</span>
              {query && (
                <button onMouseDown={() => { setOpen(false); onQuickAdd(query); }}
                  className="text-primary font-medium hover:underline text-start">
                  + Add "{query}" as new customer
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Quick Add Account Mini-Modal ──────────────────────────── */
function QuickAddAccountModal({
  open, prefill, onClose, onCreated,
}: {
  open: boolean;
  prefill: string;
  onClose: () => void;
  onCreated: (account: Account) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(prefill);
  const [code, setCode] = useState("");
  const [type, setType] = useState("Expense");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setName(prefill); }, [open, prefill]);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const created = await api<Account>("/tenant/accounts", {
        method: "POST",
        body: JSON.stringify({ code: code || undefined, name, type }),
      });
      toast.success(`Account "${name}" created`);
      onCreated(created);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("quickAddAccount")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{t("accountCode")}</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 5800" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("accountName")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing" />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              {["Asset", "Liability", "Equity", "Revenue", "Expense"].map((tp) =>
                <option key={tp}>{tp}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button className="bg-gradient-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : t("saveChanges")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Add Journal Entry Modal ───────────────────────────────── */
function AddJournalEntryModal({
  open, onClose, accounts, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const [date, setDate] = useState(today());
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState<"draft" | "posted">("posted");
  const [lines, setLines] = useState<Array<NewLine & { _id: string }>>([
    { _id: uid(), accountId: "", accountName: "", debit: "", credit: "", description: "" },
    { _id: uid(), accountId: "", accountName: "", debit: "", credit: "", description: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddPrefill, setQuickAddPrefill] = useState("");
  const [quickAddLineId, setQuickAddLineId] = useState("");

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0;

  const updateLine = (id: string, patch: Partial<NewLine>) =>
    setLines((prev) => prev.map((l) => l._id === id ? { ...l, ...patch } : l));

  const addLine = () =>
    setLines((prev) => [...prev, { _id: uid(), accountId: "", accountName: "", debit: "", credit: "", description: "" }]);

  const removeLine = (id: string) =>
    setLines((prev) => prev.filter((l) => l._id !== id));

  const handleQuickAdd = (lineId: string, typedName: string) => {
    setQuickAddLineId(lineId);
    setQuickAddPrefill(typedName);
    setQuickAddOpen(true);
  };

  const handleAccountCreated = (acc: Account) => {
    updateLine(quickAddLineId, { accountId: acc.id, accountName: acc.name });
  };

  const submit = async () => {
    if (!isBalanced) { toast.error(t("notBalanced")); return; }
    if (!desc.trim()) { toast.error("Description is required"); return; }
    setSaving(true);
    try {
      await api("/tenant/journal-entries", {
        method: "POST",
        body: JSON.stringify({
          date,
          description: desc,
          status,
          lines: lines
            .filter((l) => l.accountId)
            .map((l) => ({
              accountId: l.accountId,
              debit: Number(l.debit || 0),
              credit: Number(l.credit || 0),
              description: l.description || undefined,
            })),
        }),
      });
      toast.success("Journal entry created");
      onCreated();
      onClose();
      // reset
      setDate(today()); setDesc(""); setStatus("posted");
      setLines([
        { _id: uid(), accountId: "", accountName: "", debit: "", credit: "", description: "" },
        { _id: uid(), accountId: "", accountName: "", debit: "", credit: "", description: "" },
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("addJournalEntry")}</DialogTitle>
          </DialogHeader>

          {/* Header fields */}
          <div className="grid sm:grid-cols-3 gap-4 pt-2">
            <div className="space-y-1.5">
              <Label>{t("date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>{t("description")}</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Monthly wages" />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <Label className="text-sm">Status</Label>
            {(["draft", "posted"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                  status === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border-default text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Lines */}
          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-[1fr_80px_80px_80px_32px] gap-2 text-xs font-medium text-on-surface-variant px-1">
              <span>{t("account")}</span>
              <span className="text-end">{t("debit")}</span>
              <span className="text-end">{t("credit")}</span>
              <span>Note</span>
              <span />
            </div>
            {lines.map((line) => (
              <div key={line._id} className="grid grid-cols-[1fr_80px_80px_80px_32px] gap-2 items-center">
                <AccountCombobox
                  accounts={accounts}
                  value={line.accountName}
                  onChange={(id, name) => updateLine(line._id, { accountId: id, accountName: name })}
                  onQuickAdd={(typed) => handleQuickAdd(line._id, typed)}
                />
                <Input
                  type="number" min="0" step="0.01"
                  value={line.debit}
                  onChange={(e) => updateLine(line._id, { debit: e.target.value, credit: e.target.value ? "" : line.credit })}
                  placeholder="0.00"
                  className="h-8 text-xs text-end"
                />
                <Input
                  type="number" min="0" step="0.01"
                  value={line.credit}
                  onChange={(e) => updateLine(line._id, { credit: e.target.value, debit: e.target.value ? "" : line.debit })}
                  placeholder="0.00"
                  className="h-8 text-xs text-end"
                />
                <Input
                  value={line.description}
                  onChange={(e) => updateLine(line._id, { description: e.target.value })}
                  placeholder="optional"
                  className="h-8 text-xs"
                />
                <button
                  onClick={() => removeLine(line._id)}
                  disabled={lines.length <= 2}
                  className="text-on-surface-variant hover:text-status-error disabled:opacity-30 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addLine} className="gap-1.5 text-xs mt-1">
              <Plus className="h-3.5 w-3.5" /> {t("addLine")}
            </Button>
          </div>

          {/* Balance indicator */}
          <div className={`mt-3 flex items-center gap-2 text-sm font-medium rounded-lg p-3 ${
            totalDebit === 0
              ? "bg-surface-container text-on-surface-variant"
              : isBalanced
              ? "bg-status-success/10 text-status-success"
              : "bg-status-error/10 text-status-error"
          }`}>
            {isBalanced
              ? <CheckCircle2 className="h-4 w-4" />
              : <AlertCircle className="h-4 w-4" />}
            <span>
              {t("debit")}: {money(totalDebit)} / {t("credit")}: {money(totalCredit)}
              {!isBalanced && totalDebit > 0 && (
                <span className="ms-2 text-xs">— {t("notBalanced")}</span>
              )}
              {isBalanced && <span className="ms-2 text-xs">{t("balanced")}</span>}
            </span>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
            <Button className="bg-gradient-primary" onClick={submit} disabled={saving || !isBalanced}>
              {saving ? "Saving…" : "Save Journal Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickAddAccountModal
        open={quickAddOpen}
        prefill={quickAddPrefill}
        onClose={() => setQuickAddOpen(false)}
        onCreated={handleAccountCreated}
      />
    </>
  );
}

/* ─── Manual Invoice Modal ───────────────────────────────────── */
type InvLine = { _id: string; description: string; quantity: string; unitPrice: string; taxRate: string; revenueAccountId: string };

function ManualInvoiceModal({
  open, onClose, accounts, customers, onCreated, onCustomerCreated,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  customers: Customer[];
  onCreated: () => void;
  onCustomerCreated: (c: Customer) => void;
}) {
  const { t } = useI18n();
  const [customerId, setCustomerId] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [lines, setLines] = useState<InvLine[]>([
    { _id: uid(), description: "", quantity: "1", unitPrice: "", taxRate: "0", revenueAccountId: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const revenueAccounts = useMemo(() => accounts.filter((a) => a.type === "Revenue"), [accounts]);

  const updateLine = (id: string, patch: Partial<InvLine>) =>
    setLines((prev) => prev.map((l) => l._id === id ? { ...l, ...patch } : l));

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, l) => {
        const sub = Number(l.quantity || 0) * Number(l.unitPrice || 0);
        const tax = sub * (Number(l.taxRate || 0) / 100);
        return { subtotal: acc.subtotal + sub, tax: acc.tax + tax };
      },
      { subtotal: 0, tax: 0 }
    );
  }, [lines]);

  const handleQuickAddCustomer = async (name: string) => {
    try {
      const c = await api<Customer>("/tenant/customers", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      toast.success(`Customer "${name}" added`);
      onCustomerCreated(c);
      setCustomerId(c.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add customer");
    }
  };

  const submit = async () => {
    if (!customerId) { toast.error("Select a customer"); return; }
    setSaving(true);
    try {
      await api("/tenant/invoices", {
        method: "POST",
        body: JSON.stringify({
          customerId,
          issueDate,
          dueDate,
          lines: lines.map((l) => ({
            description: l.description || "Service",
            quantity: Number(l.quantity || 1),
            unitPrice: Number(l.unitPrice || 0),
            taxRate: Number(l.taxRate || 0),
            revenueAccountId: l.revenueAccountId || undefined,
          })),
        }),
      });
      toast.success("Invoice created");
      onCreated();
      onClose();
      setCustomerId(""); setIssueDate(today()); setDueDate(today());
      setLines([{ _id: uid(), description: "", quantity: "1", unitPrice: "", taxRate: "0", revenueAccountId: "" }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("newManualInvoice")}</DialogTitle>
        </DialogHeader>

        {/* Customer + dates */}
        <div className="grid sm:grid-cols-3 gap-4 pt-2">
          <div className="space-y-1.5 sm:col-span-1">
            <Label>{t("client")}</Label>
            <CustomerCombobox
              customers={customers}
              value=""
              onChange={(id) => setCustomerId(id)}
              onQuickAdd={handleQuickAddCustomer}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("issueDate")}</Label>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("dueDate")}</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        {/* Line items */}
        <div className="mt-5 space-y-2">
          <Label className="text-sm font-semibold">{t("lineItems")}</Label>
          <div className="grid grid-cols-[2fr_60px_90px_60px_140px_32px] gap-2 text-xs font-medium text-on-surface-variant px-1">
            <span>{t("description")}</span>
            <span className="text-center">Qty</span>
            <span className="text-end">Price</span>
            <span className="text-center">{t("taxRate")}</span>
            <span>Revenue Account</span>
            <span />
          </div>
          {lines.map((line) => (
            <div key={line._id} className="grid grid-cols-[2fr_60px_90px_60px_140px_32px] gap-2 items-center">
              <Input
                value={line.description}
                onChange={(e) => updateLine(line._id, { description: e.target.value })}
                placeholder="Service or product"
                className="h-8 text-xs"
              />
              <Input
                type="number" min="1"
                value={line.quantity}
                onChange={(e) => updateLine(line._id, { quantity: e.target.value })}
                className="h-8 text-xs text-center"
              />
              <Input
                type="number" min="0" step="0.01"
                value={line.unitPrice}
                onChange={(e) => updateLine(line._id, { unitPrice: e.target.value })}
                placeholder="0.00"
                className="h-8 text-xs text-end"
              />
              <Input
                type="number" min="0" max="100"
                value={line.taxRate}
                onChange={(e) => updateLine(line._id, { taxRate: e.target.value })}
                placeholder="0"
                className="h-8 text-xs text-center"
              />
              <select
                value={line.revenueAccountId}
                onChange={(e) => updateLine(line._id, { revenueAccountId: e.target.value })}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs w-full"
              >
                <option value="">— account —</option>
                {revenueAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} – {a.name}</option>
                ))}
              </select>
              <button
                onClick={() => lines.length > 1 && setLines((p) => p.filter((l) => l._id !== line._id))}
                disabled={lines.length <= 1}
                className="text-on-surface-variant hover:text-status-error disabled:opacity-30 transition"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button
            variant="outline" size="sm"
            onClick={() => setLines((p) => [...p, { _id: uid(), description: "", quantity: "1", unitPrice: "", taxRate: "0", revenueAccountId: "" }])}
            className="gap-1.5 text-xs mt-1"
          >
            <Plus className="h-3.5 w-3.5" /> {t("addLine")}
          </Button>
        </div>

        {/* Totals */}
        <div className="mt-4 ms-auto w-56 space-y-2 text-sm">
          <div className="flex justify-between text-on-surface-variant">
            <span>{t("subtotal")}</span><span className="font-medium">{money(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-on-surface-variant">
            <span>Tax</span><span className="font-medium">{money(totals.tax)}</span>
          </div>
          <div className="flex justify-between font-bold text-base border-t border-border-default pt-2">
            <span>Total</span><span>{money(totals.subtotal + totals.tax)}</span>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button className="bg-gradient-primary" onClick={submit} disabled={saving || !customerId}>
            {saving ? "Saving…" : t("sendInvoice")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Delete Confirm Dialog ─────────────────────────────────── */
function DeleteConfirmDialog({
  open, onClose, onConfirm,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-status-error">
            <AlertCircle className="h-5 w-5" /> {t("deleteEntry")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-on-surface-variant">{t("confirmDelete")}</p>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button
            className="bg-status-error text-white hover:bg-status-error/90"
            onClick={() => { onConfirm(); onClose(); }}
          >
            <Trash2 className="h-4 w-4 me-1" /> Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Page ─────────────────────────────────────────────── */
function Page() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jeOpen, setJeOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    try {
      const [es, accs, custs] = await Promise.all([
        api<JournalEntry[]>("/tenant/journal-entries"),
        api<Account[]>("/tenant/accounts"),
        api<Customer[]>("/tenant/customers").catch(() => [] as Customer[]),
      ]);
      setEntries(es);
      setAccounts(accs);
      setCustomers(custs);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load data");
    }
  };

  useEffect(() => { void load(); }, []);

  // Build account name lookup
  const accountMap = useMemo(() => {
    const m = new Map<string, string>();
    accounts.forEach((a) => m.set(a.id, `${a.code} – ${a.name}`));
    return m;
  }, [accounts]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api(`/tenant/journal-entries/${deleteId}`, { method: "DELETE" });
      toast.success("Entry deleted");
      setEntries((prev) => prev.filter((e) => e.id !== deleteId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete entry");
    }
  };

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="space-y-5">
      <Header
        title={t("jeTitle")}
        desc={t("jeDesc")}
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => setInvOpen(true)}
            >
              <FileText className="h-4 w-4" /> {t("newManualInvoice")}
            </Button>
            <Button
              className="bg-gradient-primary gap-1.5"
              onClick={() => setJeOpen(true)}
            >
              <Plus className="h-4 w-4" /> {t("addJournalEntry")}
            </Button>
          </div>
        }
      />

      <div className="space-y-3">
        {entries.length === 0 && (
          <div className="bg-card border border-border-default rounded-2xl p-12 text-center text-on-surface-variant shadow-soft">
            <FileText className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No journal entries yet. Create one to get started.</p>
          </div>
        )}

        {entries.map((entry) => {
          const total = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
          const isOpen = expanded.has(entry.id);

          return (
            <div key={entry.id} className="bg-card border border-border-default rounded-2xl overflow-hidden shadow-soft">
              {/* Entry header */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-surface-subtle transition-colors select-none"
                onClick={() => toggleExpand(entry.id)}
              >
                <ChevronDown className={`h-4 w-4 text-on-surface-variant shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{entry.description}</p>
                  <p className="text-xs text-on-surface-variant">
                    {String(entry.date).slice(0, 10)}
                    <span className="mx-1.5">·</span>
                    <span className="capitalize">{(entry.reference_type ?? "manual").replace("_", " ")}</span>
                    {entry.status && (
                      <>
                        <span className="mx-1.5">·</span>
                        <span className={`font-medium ${entry.status === "posted" ? "text-status-success" : "text-on-surface-variant"}`}>
                          {entry.status}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <span className="text-sm font-mono font-semibold shrink-0">{money(total)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteId(entry.id); }}
                  className="p-1.5 rounded-md text-on-surface-variant hover:bg-status-error/10 hover:text-status-error transition shrink-0"
                  title={t("deleteEntry")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Lines (collapsible) */}
              {isOpen && (
                <div className="border-t border-border-default">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-container text-xs uppercase text-on-surface-variant">
                      <tr>
                        <th className="text-start p-2 font-medium ps-4">{t("account")}</th>
                        <th className="text-start p-2 font-medium hidden sm:table-cell">{t("description")}</th>
                        <th className="text-end p-2 font-medium">{t("debit")}</th>
                        <th className="text-end p-2 font-medium pe-4">{t("credit")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default">
                      {entry.lines.map((line) => (
                        <tr key={line.id} className="hover:bg-surface-subtle/50">
                          <td className="p-2 ps-4">
                            <span className="text-sm font-medium">
                              {accountMap.get(line.account_id) ?? (
                                <span className="font-mono text-xs text-on-surface-variant">{line.account_id.slice(0, 8)}…</span>
                              )}
                            </span>
                          </td>
                          <td className="p-2 text-xs text-on-surface-variant hidden sm:table-cell">
                            {line.description ?? "—"}
                          </td>
                          <td className="p-2 text-end font-semibold text-status-success">
                            {Number(line.debit) ? money(line.debit) : <span className="text-on-surface-variant/40">—</span>}
                          </td>
                          <td className="p-2 pe-4 text-end font-semibold text-primary">
                            {Number(line.credit) ? money(line.credit) : <span className="text-on-surface-variant/40">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Totals row */}
                    <tfoot className="bg-surface-container/60">
                      <tr>
                        <td colSpan={2} className="p-2 ps-4 text-xs font-semibold text-on-surface-variant uppercase">Totals</td>
                        <td className="p-2 text-end font-bold text-status-success text-sm">
                          {money(entry.lines.reduce((s, l) => s + Number(l.debit), 0))}
                        </td>
                        <td className="p-2 pe-4 text-end font-bold text-primary text-sm">
                          {money(entry.lines.reduce((s, l) => s + Number(l.credit), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modals */}
      <AddJournalEntryModal
        open={jeOpen}
        onClose={() => setJeOpen(false)}
        accounts={accounts}
        onCreated={load}
      />

      <ManualInvoiceModal
        open={invOpen}
        onClose={() => setInvOpen(false)}
        accounts={accounts}
        customers={customers}
        onCreated={load}
        onCustomerCreated={(c) => setCustomers((prev) => [...prev, c])}
      />

      <DeleteConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

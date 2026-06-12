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
  Plus, Trash2, FileText, Search, AlertCircle, CheckCircle2, ChevronDown, X, ArrowUpFromLine, ArrowDownToLine,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/journal")({ component: Page });

/* ─── Types ─────────────────────────────────────────────────── */
type Account = { id: string; code: string; name: string; type: string };
type Customer = { id: string; name: string; email?: string };
type Vendor = { id: string; name: string; email?: string };

type JournalLine = { id: string; account_id: string; debit: string; credit: string; description?: string };
type JournalEntry = { id: string; date: string; description: string; reference_type?: string; status?: string; lines: JournalLine[] };

type NewLine = { accountId: string; accountName: string; debit: string; credit: string; description: string };

type Invoice = { id: string; invoice_number: string; total: string; customer_name?: string; status: string };
type VendorBill = { id: string; bill_number: string; total: string; vendor_name?: string; status: string };

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

/* ─── Voucher Modal (Expense / Receipt) ──────────────────────── */
function VoucherModal({
  open, onClose, type, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  type: "expense" | "receipt";
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const [parties, setParties] = useState<(Customer | Vendor)[]>([]);
  const [invoices, setInvoices] = useState<Invoice[] | VendorBill[]>([]);
  const [search, setSearch] = useState("");
  const [partyId, setPartyId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [voucherDate, setVoucherDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [saving, setSaving] = useState(false);

  const [showPartyDialog, setShowPartyDialog] = useState(false);
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyEmail, setNewPartyEmail] = useState("");
  const [partyInfo, setPartyInfo] = useState<{ name: string; email?: string } | null>(null);

  const isReceipt = type === "receipt";
  const partyEndpoint = isReceipt ? "/tenant/customers" : "/tenant/vendors";
  const invoiceEndpoint = isReceipt ? "/tenant/invoices/unpaid" : "/tenant/vendor-bills/unpaid";
  const partyLabel = isReceipt ? t("customers") : t("vendors");

  const loadDeps = async () => {
    try {
      const [ps, invs] = await Promise.all([
        api<(Customer | Vendor)[]>(partyEndpoint),
        api<Invoice[] | VendorBill[]>(invoiceEndpoint),
      ]);
      setParties(ps);
      setInvoices(invs);
    } catch {
      // ignore
    }
  };

  useEffect(() => { if (open) { setSearch(""); setPartyId(""); setInvoiceId(""); setAmount(""); setDescription(""); setVoucherDate(today()); setPaymentMethod("cash"); setPartyInfo(null); void loadDeps(); } }, [open]);

  const filteredParties = parties.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const partyInvoices = partyId
    ? invoices.filter((inv: any) => isReceipt ? inv.customer_id === partyId : inv.vendor_id === partyId)
    : [];

  const hasParty = !!partyId || !!partyInfo;

  const createPartyAndSelect = () => {
    if (!newPartyName.trim()) {
      toast.error("Please enter a name");
      return;
    }
    setPartyInfo({ name: newPartyName.trim(), email: newPartyEmail || undefined });
    setShowPartyDialog(false);
    setNewPartyName("");
    setNewPartyEmail("");
    setSearch("");
  };

  const submit = async () => {
    if (!hasParty) { toast.error(`Select a ${isReceipt ? "customer" : "vendor"}`); return; }
    if (!amount || Number(amount) <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        date: voucherDate,
        type,
        partyType: isReceipt ? "customer" : "vendor",
        description: description || (isReceipt ? "Receipt voucher" : "Expense voucher"),
        amount: Number(amount),
        invoiceId: invoiceId || undefined,
        paymentMethod,
      };
      if (partyInfo) {
        body.partyInfo = partyInfo;
      } else {
        body.partyId = partyId;
      }
      await api("/tenant/vouchers", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success(isReceipt ? "Receipt voucher recorded" : "Expense voucher recorded");
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create voucher");
    } finally {
      setSaving(false);
    }
  };

  const selectedParty = parties.find((p) => p.id === partyId);
  const displayName = selectedParty?.name ?? partyInfo?.name;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isReceipt ? t("receiptVoucher") : t("expenseVoucher")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{partyLabel}</Label>
            {hasParty ? (
              <div className="flex items-center gap-2 p-2 bg-surface-container rounded-lg border border-border-default">
                <span className="flex-1 text-sm font-medium">{displayName}</span>
                <Button variant="ghost" size="sm" onClick={() => { setPartyId(""); setPartyInfo(null); }}>Change</Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  <Input className="ps-9" placeholder={t("searchParty")} value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                {search && (
                  <div className="max-h-32 overflow-y-auto border border-border-default rounded-lg divide-y">
                    {filteredParties.length === 0 ? (
                      <div className="p-3 text-sm text-center text-on-surface-variant">
                        Not found.{' '}
                        <button onClick={() => setShowPartyDialog(true)} className="text-primary underline">
                          Add new {isReceipt ? "customer" : "vendor"}
                        </button>
                      </div>
                    ) : (
                      filteredParties.map((p) => (
                        <button
                          key={p.id}
                          className="w-full text-start p-2 text-sm hover:bg-surface-subtle"
                          onClick={() => { setPartyId(p.id); setSearch(""); }}
                        >
                          {p.name}
                          {p.email && <span className="text-xs text-on-surface-variant ms-2">{p.email}</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {hasParty && (
            <div className="space-y-1.5">
              <Label>{t("selectInvoice")} ({isReceipt ? t("customers") : t("vendors")})</Label>
              <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">{t("autoPayOldest")}</option>
                {partyInvoices.map((inv: any) => (
                  <option key={inv.id} value={inv.id}>
                    {(inv.invoice_number || inv.bill_number)} - {money(inv.total)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t("voucherAmount")}</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="0.00" />
          </div>

          <div className="space-y-1.5">
            <Label>{t("voucherDescription")}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("date")}</Label>
              <Input value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} type="date" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("paymentMethod")}</Label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="card">Card</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button className="bg-gradient-primary" onClick={submit} disabled={saving || !hasParty || !amount}>
            {saving ? "Saving…" : t("recordVoucher")}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Quick Add Party Dialog */}
      <Dialog open={showPartyDialog} onOpenChange={setShowPartyDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New {isReceipt ? "Customer" : "Vendor"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("fullName")}</Label>
              <Input value={newPartyName} onChange={(e) => setNewPartyName(e.target.value)} placeholder="Name" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("email")}</Label>
              <Input value={newPartyEmail} onChange={(e) => setNewPartyEmail(e.target.value)} type="email" placeholder="email@example.com" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowPartyDialog(false)}>{t("cancel")}</Button>
            <Button className="bg-gradient-primary" onClick={createPartyAndSelect}>Add & Select</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
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
  const [jeOpen, setJeOpen] = useState(false);
  const [expVoucherOpen, setExpVoucherOpen] = useState(false);
  const [recVoucherOpen, setRecVoucherOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    try {
      const [es, accs] = await Promise.all([
        api<JournalEntry[]>("/tenant/journal-entries"),
        api<Account[]>("/tenant/accounts"),
      ]);
      setEntries(es);
      setAccounts(accs);
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
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => setExpVoucherOpen(true)}
            >
              <ArrowDownToLine className="h-4 w-4" /> {t("expenseVoucher")}
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => setRecVoucherOpen(true)}
            >
              <ArrowUpFromLine className="h-4 w-4" /> {t("receiptVoucher")}
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

      <VoucherModal
        open={expVoucherOpen}
        onClose={() => setExpVoucherOpen(false)}
        type="expense"
        onCreated={load}
      />

      <VoucherModal
        open={recVoucherOpen}
        onClose={() => setRecVoucherOpen(false)}
        type="receipt"
        onCreated={load}
      />

      <DeleteConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Header, StatusBadge } from "./dashboard.transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, X, Filter, ChevronDown, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api, money } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import CreateInvoiceDialog from "@/components/CreateInvoiceDialog";

export const Route = createFileRoute("/dashboard/expenses/manage")({ component: ManageExpenses });

type Expense = {
  id: string;
  bill_number: string;
  vendor_id: string | null;
  vendor_name: string | null;
  issue_date: string;
  due_date: string;
  total: string;
  status: string;
};

function ManageExpenses() {
  const { t } = useI18n();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = async () => {
    try {
      setExpenses(await api<Expense[]>("/tenant/vendor-bills?type=expense"));
    } catch {
      toast.error("Could not load expenses");
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (search && !`${e.bill_number} ${e.vendor_name ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter && e.status !== statusFilter) return false;
      if (vendorFilter && e.vendor_id !== vendorFilter) return false;
      if (dateFrom && e.issue_date.slice(0, 10) < dateFrom) return false;
      if (dateTo && e.issue_date.slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [expenses, search, statusFilter, vendorFilter, dateFrom, dateTo]);

  const activeFilterCount = [statusFilter, vendorFilter, dateFrom, dateTo].filter(Boolean).length;
  const vendors = Array.from(new Map(
    expenses
      .filter((expense) => expense.vendor_id && expense.vendor_name)
      .map((expense) => [expense.vendor_id!, { id: expense.vendor_id!, name: expense.vendor_name! }]),
  ).values()).sort((a, b) => a.name.localeCompare(b.name));

  const clearFilters = () => {
    setStatusFilter("");
    setVendorFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`/tenant/vendor-bills/${id}`, { method: "DELETE" });
      toast.success("Expense deleted");
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete expense");
    }
  };

  return (
    <div className="space-y-5">
      <Header
        title={t("manageExpenses")}
        desc={t("expensesDesc")}
        action={
          <Button className="bg-gradient-primary gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("createExpense")}
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <Input className="ps-9 bg-card" placeholder="Search expenses..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch("")} className="absolute end-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button variant={filterOpen ? "default" : "outline"} size="sm" className="gap-1.5 relative" onClick={() => setFilterOpen((v) => !v)}>
          <Filter className="h-4 w-4" /> {t("filter")}
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -end-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] grid place-items-center">{activeFilterCount}</span>
          )}
          <ChevronDown className={`h-3 w-3 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-on-surface-variant gap-1">
            <X className="h-3 w-3" /> Clear filters
          </Button>
        )}
      </div>

      {filterOpen && (
        <div className="bg-card border border-border-default rounded-2xl p-4 shadow-soft grid sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("status")}</Label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="received">Received</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Vendor</Label>
            <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">All vendors</option>
              {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("dateFrom")}</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("dateTo")}</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
      )}

      {(search || activeFilterCount > 0) && (
        <p className="text-xs text-on-surface-variant">
          Showing <span className="font-semibold text-on-surface">{filtered.length}</span> of {expenses.length} expenses
        </p>
      )}

      <div className="bg-card border border-border-default rounded-2xl overflow-hidden shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-surface-container text-on-surface-variant text-xs uppercase">
            <tr>
              <th className="text-start p-3 font-medium">{t("number")}</th>
              <th className="text-start p-3 font-medium">Vendor</th>
              <th className="text-start p-3 font-medium">{t("issued")}</th>
              <th className="text-start p-3 font-medium">{t("dueDate")}</th>
              <th className="text-start p-3 font-medium">{t("status")}</th>
              <th className="text-end p-3 font-medium">{t("amount")}</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-on-surface-variant text-sm">No expenses found.</td></tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id} className="hover:bg-surface-subtle cursor-pointer" onClick={() => setEditingId(e.id)}>
                  <td className="p-3 font-medium text-primary">{e.bill_number}</td>
                  <td className="p-3">{e.vendor_name || "No vendor"}</td>
                  <td className="p-3 text-on-surface-variant">{String(e.issue_date).slice(0, 10)}</td>
                  <td className="p-3 text-on-surface-variant">{String(e.due_date).slice(0, 10)}</td>
                  <td className="p-3"><StatusBadge status={e.status} /></td>
                  <td className="p-3 text-end font-semibold">{money(e.total)}</td>
                  <td className="p-3">
                    <button onClick={(event) => { event.stopPropagation(); void handleDelete(e.id); }} className="p-1 rounded text-on-surface-variant hover:text-status-error hover:bg-status-error/10 transition" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <CreateInvoiceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t("expenseEntry")}
        type="expenses"
        onCreated={load}
      />
      <CreateInvoiceDialog
        open={Boolean(editingId)}
        onOpenChange={(open) => { if (!open) setEditingId(null); }}
        title={t("expenseEntry")}
        type="expenses"
        documentId={editingId ?? undefined}
        onCreated={load}
      />
    </div>
  );
}

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

export const Route = createFileRoute("/dashboard/sales/manage")({ component: ManageSalesPage });

type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  issue_date: string;
  due_date: string;
  total: string;
  remaining_amount?: string;
  status: string;
};

function ManageSalesPage() {
  const { t, l } = useI18n();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = async () => {
    try {
      setInvoices(await api<Invoice[]>("/tenant/invoices"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load invoices");
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (search && !`${inv.invoice_number} ${inv.customer_name}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter && inv.status !== statusFilter) return false;
      if (customerFilter && inv.customer_id !== customerFilter) return false;
      if (dateFrom && inv.issue_date.slice(0, 10) < dateFrom) return false;
      if (dateTo && inv.issue_date.slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [invoices, search, statusFilter, customerFilter, dateFrom, dateTo]);

  const activeFilterCount = [statusFilter, customerFilter, dateFrom, dateTo].filter(Boolean).length;
  const customers = Array.from(new Map(invoices.map((invoice) => [
    invoice.customer_id,
    { id: invoice.customer_id, name: invoice.customer_name },
  ])).values()).sort((a, b) => a.name.localeCompare(b.name));

  const clearFilters = () => {
    setStatusFilter("");
    setCustomerFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`/tenant/invoices/${id}`, { method: "DELETE" });
      toast.success("Invoice deleted");
      setInvoices((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete invoice");
    }
  };

  return (
    <div className="space-y-5">
      <Header
        title={t("manageSales")}
        desc={t("salesDesc")}
        action={
          <Button className="bg-gradient-primary gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("createInvoice")}
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <Input className="ps-9 bg-card" placeholder={l("Search invoices...")} value={search} onChange={(e) => setSearch(e.target.value)} />
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
              <option value="">{l("All statuses")}</option>
              <option value="draft">{l("Draft")}</option>
              <option value="unpaid">{l("Unpaid")}</option>
              <option value="paid">{l("Paid")}</option>
              <option value="partial">{l("Partial")}</option>
              <option value="overdue">{t("overdue")}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{l("Customer")}</Label>
            <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">{l("All customers")}</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
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
          Showing <span className="font-semibold text-on-surface">{filtered.length}</span> of {invoices.length} invoices
        </p>
      )}

      <div className="bg-card border border-border-default rounded-2xl overflow-hidden shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-surface-container text-on-surface-variant text-xs uppercase">
            <tr>
              <th className="text-start p-3 font-medium">{t("number")}</th>
              <th className="text-start p-3 font-medium">{l("Customer")}</th>
              <th className="text-start p-3 font-medium">{t("issued")}</th>
              <th className="text-start p-3 font-medium">{t("dueDate")}</th>
              <th className="text-start p-3 font-medium">{t("status")}</th>
              <th className="text-end p-3 font-medium">{t("amount")}</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-on-surface-variant text-sm">{l("No invoices found.")}</td></tr>
            ) : (
              filtered.map((i) => (
                <tr key={i.id} className="hover:bg-surface-subtle cursor-pointer" onClick={() => setEditingId(i.id)}>
                  <td className="p-3 font-medium text-primary">{i.invoice_number}</td>
                  <td className="p-3">{i.customer_name}</td>
                  <td className="p-3 text-on-surface-variant">{String(i.issue_date).slice(0, 10)}</td>
                  <td className="p-3 text-on-surface-variant">{String(i.due_date).slice(0, 10)}</td>
                  <td className="p-3"><StatusBadge status={i.status} /></td>
                  <td className="p-3 text-end">
                    <div className="font-semibold">{money(i.total)}</div>
                    {i.status === "partial" && (
                      <div className="text-xs text-status-warning font-medium">
                        {l("Remaining")}: {money(i.remaining_amount ?? i.total)}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <button onClick={(event) => { event.stopPropagation(); void handleDelete(i.id); }} className="p-1 rounded text-on-surface-variant hover:text-status-error hover:bg-status-error/10 transition" title="Delete">
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
        title={t("salesInvoice")}
        type="sales"
        onCreated={load}
      />
      <CreateInvoiceDialog
        open={Boolean(editingId)}
        onOpenChange={(open) => { if (!open) setEditingId(null); }}
        title={t("salesInvoice")}
        type="sales"
        documentId={editingId ?? undefined}
        onCreated={load}
      />
    </div>
  );
}

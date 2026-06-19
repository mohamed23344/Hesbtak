import { createFileRoute } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Filter, Download, X, ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api, money } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/transactions")({ component: Page });

type Account = { id: string; code: string; name: string; type: string };

type Entry = {
  id: string;
  date: string;
  description: string;
  status: string;
  reference_type?: string;
  lines: Array<{ account_id: string; debit: string; credit: string }>;
};

const REF_TYPES = ["manual", "invoice", "vendor_bill", "expense", "payment"];

function Page() {
  const { t, l } = useI18n();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [accountFilter, setAccountFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [refTypeFilter, setRefTypeFilter] = useState("");

  useEffect(() => {
    api<Entry[]>("/tenant/journal-entries")
      .then(setEntries)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load transactions"));
    api<Account[]>("/tenant/accounts")
      .then(setAccounts)
      .catch(() => null);
  }, []);

  // Build account name lookup
  const accountMap = useMemo(() => {
    const m = new Map<string, string>();
    accounts.forEach((a) => m.set(a.id, `${a.code} – ${a.name}`));
    return m;
  }, [accounts]);

  const activeFilterCount = [accountFilter, dateFrom, dateTo, refTypeFilter].filter(Boolean).length;

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      // Full-text search on description
      if (search && !e.description.toLowerCase().includes(search.toLowerCase())) return false;
      // Reference type filter
      if (refTypeFilter && (e.reference_type ?? "manual") !== refTypeFilter) return false;
      // Date from / to
      if (dateFrom && e.date.slice(0, 10) < dateFrom) return false;
      if (dateTo && e.date.slice(0, 10) > dateTo) return false;
      // Account filter — entry must have at least one line touching the account
      if (accountFilter && !e.lines.some((l) => l.account_id === accountFilter)) return false;
      return true;
    });
  }, [entries, search, refTypeFilter, dateFrom, dateTo, accountFilter]);

  const clearFilters = () => {
    setAccountFilter("");
    setDateFrom("");
    setDateTo("");
    setRefTypeFilter("");
  };

  return (
    <div className="space-y-5">
      <Header title={t("txTitle")} desc={t("txDesc")} />

      {/* Search + toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <Input
            placeholder={t("searchTransactions")}
            className="ps-9 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          variant={filterOpen ? "default" : "outline"}
          size="sm"
          className="gap-1.5 relative"
          onClick={() => setFilterOpen((v) => !v)}
        >
          <Filter className="h-4 w-4" />
          {t("filter")}
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -end-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] grid place-items-center">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown className={`h-3 w-3 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-on-surface-variant gap-1">
            <X className="h-3 w-3" /> Clear filters
          </Button>
        )}
        <Button variant="outline" size="sm" className="gap-1.5 ms-auto">
          <Download className="h-4 w-4" /> {t("export")}
        </Button>
      </div>

      {/* Filter Panel */}
      {filterOpen && (
        <div className="bg-card border border-border-default rounded-2xl p-4 shadow-soft grid sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Account filter */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("account")}</Label>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("allAccounts")}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} – {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Ref type filter */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("refType")}</Label>
            <select
              value={refTypeFilter}
              onChange={(e) => setRefTypeFilter(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm capitalize"
            >
              <option value="">{t("allTypes")}</option>
              {REF_TYPES.map((rt) => (
                <option key={rt} value={rt} className="capitalize">
                  {rt.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("dateFrom")}</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Date to */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("dateTo")}</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>
      )}

      {/* Results summary */}
      {(search || activeFilterCount > 0) && (
        <p className="text-xs text-on-surface-variant">
          Showing <span className="font-semibold text-on-surface">{filtered.length}</span> of {entries.length} entries
        </p>
      )}

      {/* Table */}
      <div className="bg-card border border-border-default rounded-2xl overflow-hidden shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-surface-container text-on-surface-variant text-xs uppercase">
            <tr>
              <th className="text-start p-3 font-medium">{t("date")}</th>
              <th className="text-start p-3 font-medium">{t("description")}</th>
              <th className="text-start p-3 font-medium">{t("account")}</th>
              <th className="text-start p-3 font-medium">{t("refType")}</th>
              <th className="text-start p-3 font-medium">{t("status")}</th>
              <th className="text-end p-3 font-medium">{t("amount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-on-surface-variant text-sm">
                  {l("No transactions match your filters.")}
                </td>
              </tr>
            ) : (
              filtered.map((entry) => {
                const amount = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
                // Show first account name or count
                const firstLine = entry.lines[0];
                const accountLabel = firstLine
                  ? accountMap.get(firstLine.account_id) ?? firstLine.account_id.slice(0, 8) + "…"
                  : "—";
                const extraLines = entry.lines.length > 1 ? ` +${entry.lines.length - 1}` : "";
                return (
                  <tr key={entry.id} className="hover:bg-surface-subtle transition-colors">
                    <td className="p-3 text-on-surface-variant whitespace-nowrap">{String(entry.date).slice(0, 10)}</td>
                    <td className="p-3 font-medium">{entry.description}</td>
                    <td className="p-3 text-on-surface-variant text-xs">
                      {accountLabel}
                      {extraLines && <span className="text-primary font-medium">{extraLines}</span>}
                    </td>
                    <td className="p-3">
                      <span className="capitalize text-on-surface-variant text-xs">
                        {l(entry.reference_type ?? "manual")}
                      </span>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={entry.status ?? "posted"} />
                    </td>
                    <td className="p-3 text-end font-semibold">{money(amount)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { l } = useI18n();
  const map: Record<string, string> = {
    completed: "bg-status-success/10 text-status-success",
    posted: "bg-status-success/10 text-status-success",
    unpaid: "bg-status-warning/10 text-status-warning",
    partial: "bg-status-warning/10 text-status-warning",
    pending: "bg-status-warning/10 text-status-warning",
    failed: "bg-status-error/10 text-status-error",
    paid: "bg-status-success/10 text-status-success",
    overdue: "bg-status-error/10 text-status-error",
    draft: "bg-surface-container text-on-surface-variant",
    received: "bg-status-warning/10 text-status-warning",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${map[status] ?? "bg-surface-container"}`}>
      {l(status)}
    </span>
  );
}

export function Header({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {desc && <p className="mt-1 text-base text-on-surface-variant">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { TrendingUp, TrendingDown, DollarSign, Wallet, AlertTriangle, Sparkles, Lightbulb } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { api, money } from "@/lib/api";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/")({ component: DashboardHome });

type Kpis = {
  cash: number;
  revenue: number;
  expenses: number;
  netIncome: number;
  accountsReceivable: number;
  accountsPayable: number;
};

function DashboardHome() {
  const { t } = useI18n();
  const [kpis, setKpis] = useState<Kpis>({
    cash: 0,
    revenue: 0,
    expenses: 0,
    netIncome: 0,
    accountsReceivable: 0,
    accountsPayable: 0,
  });
  const [alerts, setAlerts] = useState<Array<{ id: string; title: string; message: string; severity: string }>>([]);
  const [suggestions, setSuggestions] = useState<Array<{ id: string; title: string; description: string }>>([]);

  useEffect(() => {
    api<Kpis>("/tenant/insights/dashboard")
      .then(setKpis)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load dashboard"));
    api<Array<{ id: string; title: string; message: string; severity: string }>>("/tenant/alerts").then(setAlerts).catch(() => null);
    api<Array<{ id: string; title: string; description: string }>>("/tenant/suggestions").then(setSuggestions).catch(() => null);
  }, []);

  const cashflow = [
    { m: "AR", in: kpis.accountsReceivable, out: 0 },
    { m: "AP", in: 0, out: kpis.accountsPayable },
    { m: "Rev", in: kpis.revenue, out: 0 },
    { m: "Exp", in: 0, out: kpis.expenses },
    { m: "Cash", in: Math.max(kpis.cash, 0), out: Math.max(-kpis.cash, 0) },
  ];
  const categories = [
    { c: "Expenses", v: kpis.expenses },
    { c: "Payables", v: kpis.accountsPayable },
    { c: "Receivables", v: kpis.accountsReceivable },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("welcomeBack")}</h1>
        <p className="text-on-surface-variant text-sm">{t("dashboardDesc")}</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label={t("revenue")} value={money(kpis.revenue)} delta="Live" up icon={DollarSign} />
        <Kpi label={t("expenses")} value={money(kpis.expenses)} delta="Live" icon={Wallet} />
        <Kpi label={t("netProfit")} value={money(kpis.netIncome)} delta="Live" up={kpis.netIncome >= 0} down={kpis.netIncome < 0} icon={TrendingUp} />
        <Kpi label={t("cashOnHand")} value={money(kpis.cash)} delta="Live" down={kpis.cash < 0} icon={Wallet} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border-default rounded-2xl p-5 shadow-soft">
          <h3 className="font-semibold mb-1">{t("cashflow")}</h3>
          <p className="text-xs text-on-surface-variant mb-4">Tenant ledger snapshot</p>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={cashflow}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="m" stroke="var(--on-surface-variant)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--on-surface-variant)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Area type="monotone" dataKey="in" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.18} strokeWidth={2} />
                <Area type="monotone" dataKey="out" stroke="var(--status-error)" fill="var(--status-error)" fillOpacity={0.14} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border-default rounded-2xl p-5 shadow-soft">
          <h3 className="font-semibold mb-1">{t("topExpenseCategories")}</h3>
          <p className="text-xs text-on-surface-variant mb-3">Current balances</p>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={categories} layout="vertical">
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="c" type="category" stroke="var(--on-surface-variant)" fontSize={12} tickLine={false} axisLine={false} width={86} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Bar dataKey="v" fill="var(--accent)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-gradient-primary text-primary-foreground rounded-2xl p-6 shadow-card">
          <div className="flex items-center gap-2 text-sm opacity-90"><Sparkles className="h-4 w-4" /> {t("aiInsights")}</div>
          <h3 className="mt-1 text-lg font-semibold">{t("thingsToKnow")}</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {(suggestions.length ? suggestions : [{ id: "empty", title: "Add transactions", description: "Suggestions appear after invoices, bills, or expenses are posted." }]).map((item) => (
              <li key={item.id} className="flex gap-2 bg-white/10 rounded-lg p-3">
                <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" /> {item.title}: {item.description}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-card border border-border-default rounded-2xl p-6 shadow-soft">
          <div className="flex items-center gap-2 text-sm text-status-warning">
            <AlertTriangle className="h-4 w-4" /> {t("alerts")}
          </div>
          <h3 className="mt-1 text-lg font-semibold">{t("thingsAttention")}</h3>
          <ul className="mt-4 divide-y divide-border-default">
            {(alerts.length ? alerts.slice(0, 5) : [{ id: "none", title: "No alerts", message: "Due date and threshold alerts will show here.", severity: "info" }]).map((alert) => (
              <li key={alert.id} className="py-3 flex items-start gap-3">
                <span className={`mt-1.5 h-2 w-2 rounded-full ${alert.severity === "critical" ? "bg-status-error" : "bg-status-warning"}`} />
                <div>
                  <p className="font-medium text-sm">{alert.title}</p>
                  <p className="text-xs text-on-surface-variant">{alert.message}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label, value, delta, up, down, icon: Icon,
}: {
  label: string; value: string; delta: string; up?: boolean; down?: boolean; icon: React.ElementType;
}) {
  const Trend = up ? TrendingUp : down ? TrendingDown : TrendingUp;
  const tone = up ? "text-status-success bg-status-success/10" : down ? "text-status-error bg-status-error/10" : "text-on-surface-variant bg-surface-container";
  return (
    <div className="bg-card border border-border-default rounded-2xl p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-sm text-on-surface-variant">{label}</p>
        <div className="h-9 w-9 rounded-lg bg-surface-container text-primary grid place-items-center">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
      <span className={`mt-2 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${tone}`}>
        <Trend className="h-3 w-3" /> {delta}
      </span>
    </div>
  );
}

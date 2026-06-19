import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { TrendingUp, TrendingDown, DollarSign, Wallet, AlertTriangle, Sparkles, Lightbulb } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api, money, getSession } from "@/lib/api";
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
  const { t, l, lang } = useI18n();
  const session = getSession();
  const firstName = session?.user.fullName?.split(" ")[0] ?? "";
  const greeting =
    lang === "ar"
      ? `مرحباً بعودتك${firstName ? "، " + firstName : ""} `
      : `Welcome back${firstName ? ", " + firstName : ""} `;
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
    { m: l("Receivables"), in: kpis.accountsReceivable, out: 0 },
    { m: l("Payables"), in: 0, out: kpis.accountsPayable },
    { m: t("revenue"), in: kpis.revenue, out: 0 },
    { m: t("expenses"), in: 0, out: kpis.expenses },
    { m: t("cashOnHand"), in: Math.max(kpis.cash, 0), out: Math.max(-kpis.cash, 0) },
  ];
  const categories = [
    { c: t("expenses"), v: kpis.expenses },
    { c: l("Payables"), v: kpis.accountsPayable },
    { c: l("Receivables"), v: kpis.accountsReceivable },
  ];
  const categoryMax = Math.max(0, ...categories.map((category) => category.v));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
          <p className="text-on-surface-variant text-sm mt-0.5">{t("dashboardDesc")}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label={t("revenue")} value={money(kpis.revenue)} delta={l("Live")} up icon={DollarSign} />
        <Kpi label={t("expenses")} value={money(kpis.expenses)} delta={l("Live")} icon={Wallet} />
        <Kpi label={t("netProfit")} value={money(kpis.netIncome)} delta={l("Live")} up={kpis.netIncome >= 0} down={kpis.netIncome < 0} icon={TrendingUp} />
        <Kpi label={t("cashOnHand")} value={money(kpis.cash)} delta={l("Live")} down={kpis.cash < 0} icon={Wallet} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card/80 glass-panel rounded-2xl p-5 shadow-soft hover-glow">
          <h3 className="font-semibold text-lg mb-0.5">{t("cashflow")}</h3>
          <p className="text-xs text-on-surface-variant mb-4">{l("Tenant ledger snapshot")}</p>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={cashflow}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="m" stroke="var(--on-surface-variant)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--on-surface-variant)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)" }} />
                <Area type="monotone" dataKey="in" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.18} strokeWidth={2} />
                <Area type="monotone" dataKey="out" stroke="var(--status-error)" fill="var(--status-error)" fillOpacity={0.14} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card/80 glass-panel rounded-2xl p-5 shadow-soft hover-glow">
          <h3 className="font-semibold text-lg mb-0.5">{t("topExpenseCategories")}</h3>
          <p className="text-xs text-on-surface-variant mb-3">{l("Current balances")}</p>
          <div className="h-64 grid content-center gap-5" role="img" aria-label={t("topExpenseCategories")}>
            {categories.map((category) => {
              const width = categoryMax > 0 && category.v > 0
                ? Math.max(4, (category.v / categoryMax) * 100)
                : 0;
              return (
                <div key={category.c} className="min-w-0">
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-medium text-on-surface-variant">{category.c}</span>
                    <span className="shrink-0 font-semibold text-on-surface">{money(category.v)}</span>
                  </div>
                  <div className="flex h-8 overflow-hidden rounded-lg bg-surface-container" title={`${category.c}: ${money(category.v)}`}>
                    <div
                      className="h-full rounded-lg bg-accent transition-[width] duration-300"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-gradient-primary text-primary-foreground rounded-2xl p-6 shadow-card hover-glow relative overflow-hidden">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-accent/20 blur-2xl rounded-full" />
          <div className="relative z-10 flex items-center gap-2 text-sm opacity-90"><Sparkles className="h-4 w-4" /> {t("aiInsights")}</div>
          <h3 className="relative z-10 mt-1 text-lg font-semibold">{t("thingsToKnow")}</h3>
          <ul className="relative z-10 mt-4 space-y-3 text-sm">
            {(suggestions.length ? suggestions : [{ id: "empty", title: l("Add transactions"), description: l("Suggestions appear after invoices, bills, or expenses are posted.") }]).map((item) => (
              <li key={item.id} className="flex gap-2 bg-white/10 backdrop-blur-xs rounded-lg p-3">
                <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-accent" /> {item.title}: {item.description}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-card/80 glass-panel rounded-2xl p-6 shadow-soft hover-glow">
          <div className="flex items-center gap-2 text-sm text-status-warning font-semibold">
            <AlertTriangle className="h-4 w-4" /> {t("alerts")}
          </div>
          <h3 className="mt-1 text-lg font-semibold">{t("thingsAttention")}</h3>
          <ul className="mt-4 divide-y divide-border-default/60">
            {(alerts.length ? alerts.slice(0, 5) : [{ id: "none", title: l("No alerts"), message: l("Due date and threshold alerts will show here."), severity: "info" }]).map((alert) => (
              <li key={alert.id} className="py-3 flex items-start gap-3">
                <span className={`mt-1.5 h-2 w-2 rounded-full ${alert.severity === "critical" ? "bg-status-error animate-pulse" : "bg-status-warning"}`} />
                <div>
                  <p className="font-semibold text-sm">{alert.title}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">{alert.message}</p>
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
    <div className="bg-card/80 glass-panel rounded-2xl p-5 shadow-soft hover-glow">
      <div className="flex items-center justify-between">
        <p className="text-sm text-on-surface-variant font-medium">{label}</p>
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-on-surface">{value}</p>
      <span className={`mt-2.5 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${tone}`}>
        <Trend className="h-3 w-3 rtl:rotate-180" /> {delta}
      </span>
    </div>
  );
}

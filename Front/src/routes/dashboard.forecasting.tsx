import { createFileRoute } from "@tanstack/react-router";
import { Header } from "./dashboard.transactions";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Legend } from "recharts";
import { useI18n } from "@/lib/i18n";
import { api, money } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/forecasting")({ component: Page });

type ForecastPoint = {
  forecastMonth: string;
  predictedRevenue: number;
  predictedExpense: number;
  predictedCashflow: number;
};

function Page() {
  const { t } = useI18n();
  const [data, setData] = useState<ForecastPoint[]>([]);

  useEffect(() => {
    api<{ months: ForecastPoint[] }>("/tenant/forecasts?months=12")
      .then((result) => setData(result.months))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load forecasts"));
  }, []);

  const totals = useMemo(() => ({
    revenue: data.reduce((sum, item) => sum + item.predictedRevenue, 0),
    expense: data.reduce((sum, item) => sum + item.predictedExpense, 0),
    cash: data.reduce((sum, item) => sum + item.predictedCashflow, 0),
  }), [data]);

  const chartData = data.map((item) => ({
    m: item.forecastMonth.slice(5, 7),
    forecast: item.predictedRevenue,
    expense: item.predictedExpense,
    cashflow: item.predictedCashflow,
  }));

  return (
    <div className="space-y-5">
      <Header title={t("fcTitle")} desc={t("fcDesc")} />

      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { l: t("predictedRevenue"), v: money(totals.revenue) },
          { l: t("predictedExpenses"), v: money(totals.expense) },
          { l: t("predictedCash"), v: money(totals.cash) },
        ].map((s) => (
          <div key={s.l} className="bg-card border border-border-default rounded-2xl p-5">
            <p className="text-sm text-on-surface-variant">{s.l}</p>
            <p className="text-2xl font-bold mt-2">{s.v}</p>
            <p className="text-xs text-status-success mt-1">baseline forecast</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border-default rounded-2xl p-5 shadow-soft">
        <div className="mb-4">
          <h3 className="font-semibold">{t("forecastActualVsForecast")}</h3>
          <p className="text-xs text-on-surface-variant">{t("forecastDashedLine")}</p>
        </div>
        <div className="h-80">
          <ResponsiveContainer>
            <ComposedChart data={chartData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="m" stroke="var(--on-surface-variant)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--on-surface-variant)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Legend />
              <Line type="monotone" dataKey="forecast" stroke="var(--accent)" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3 }} name="Revenue forecast" />
              <Line type="monotone" dataKey="expense" stroke="var(--status-error)" strokeWidth={2} dot={false} name="Expenses" />
              <Line type="monotone" dataKey="cashflow" stroke="var(--primary)" strokeWidth={2} dot={false} name="Cashflow" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

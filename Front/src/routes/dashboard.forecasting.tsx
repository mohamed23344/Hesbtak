import { createFileRoute } from "@tanstack/react-router";
import { Header } from "./dashboard.transactions";
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
  confidenceLow?: number;
  confidenceHigh?: number;
  formulaUsed?: string;
  calculationDetails?: {
    revenueMethod: string;
    expenseMethod: string;
    revenueGrowthRate: number;
    expenseGrowthRate: number;
    seasonalFactorApplied: {
      revenue: number;
      expenses: number;
    };
  };
};

type MonthlyActual = {
  month: string;
  revenue: number;
  expenses: number;
  cashCollected: number;
  vendorPaid: number;
};

type ChartDatum = {
  key: string;
  label: string;
  revenueActual: number | null;
  revenueForecast: number | null;
  revenueUpper: number | null;
  revenueLower: number | null;
  expenseActual: number | null;
  expenseForecast: number | null;
  expenseUpper: number | null;
  expenseLower: number | null;
  cashActual: number | null;
  cashForecast: number | null;
};

type ForecastResponse = {
  modelVersion: string;
  forecastPrinciples: {
    deterministic: boolean;
    externalDataUsed: boolean;
    aiOrMlUsed: boolean;
    tenantIsolation: string;
  };
  method: {
    revenue: string;
    expenses: string;
    cashflow: string;
  };
  formulaUsed: string[];
  sourceData: {
    historicalPeriods: string[];
    tables: string[];
    records: { source_type: string; id: string; reference: string | null; record_date: string; total: string }[];
  };
  calculationDetails: {
    forecastHorizonMonths: number;
    historicalPeriodCount: number;
    revenueGrowthRate: number;
    expenseGrowthRate: number;
    revenueVarianceCoefficient: number;
    expenseVarianceCoefficient: number;
    monthlyActuals: MonthlyActual[];
  };
  confidence: {
    score: number;
    explanation: string;
    factors: {
      historicalDataAvailability: number;
      historicalVariance: number;
      seasonalConsistency: number;
      dataCompleteness: number;
    };
  };
  months: ForecastPoint[];
};

function Page() {
  const { t, l, lang } = useI18n();
  const [data, setData] = useState<ForecastPoint[]>([]);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [visibleSeries, setVisibleSeries] = useState({
    revenue: true,
    expenses: true,
    cashflow: true,
  });

  useEffect(() => {
    api<ForecastResponse>("/tenant/forecasts?months=12")
      .then((result) => {
        setForecast(result);
        setData(result.months);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load forecasts"));
  }, []);

  const firstForecast = data[0];
  const cash90 = data.slice(0, 3).reduce((sum, item) => sum + item.predictedCashflow, 0);
  const confidenceBandRatio = forecast ? Math.max(0.08, 1 - forecast.confidence.score / 100) : 0.2;
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const todayKey = currentMonthKey();

  const chartData = useMemo(() => {
    const historical: ChartDatum[] = (forecast?.calculationDetails.monthlyActuals ?? []).slice(-4).map((item) => ({
      key: monthKey(item.month),
      label: monthLabel(item.month, locale),
      revenueActual: item.revenue,
      revenueForecast: null as number | null,
      revenueUpper: null as number | null,
      revenueLower: null as number | null,
      expenseActual: item.expenses,
      expenseForecast: null as number | null,
      expenseUpper: null as number | null,
      expenseLower: null as number | null,
      cashActual: item.revenue - item.expenses,
      cashForecast: null as number | null,
    }));
    const forecastRows: ChartDatum[] = data.slice(0, 5).map((item) => ({
      key: monthKey(item.forecastMonth),
      label: monthLabel(item.forecastMonth, locale),
      revenueActual: null as number | null,
      revenueForecast: item.predictedRevenue,
      revenueUpper: item.predictedRevenue * (1 + confidenceBandRatio),
      revenueLower: item.predictedRevenue * Math.max(0, 1 - confidenceBandRatio),
      expenseActual: null as number | null,
      expenseForecast: item.predictedExpense,
      expenseUpper: item.predictedExpense * (1 + confidenceBandRatio),
      expenseLower: item.predictedExpense * Math.max(0, 1 - confidenceBandRatio),
      cashActual: null as number | null,
      cashForecast: item.predictedCashflow,
    }));
    return [...historical, ...forecastRows];
  }, [data, forecast, confidenceBandRatio, locale]);

  const chartMax = useMemo(
    () =>
      chartData.reduce((max, item) => {
        const values = [
          item.revenueActual,
          item.revenueForecast,
          item.revenueUpper,
          item.expenseActual,
          item.expenseForecast,
          item.expenseUpper,
          item.cashActual,
          item.cashForecast,
        ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
        return Math.max(max, ...values.map((value) => Math.abs(value)));
      }, 0),
    [chartData],
  );
  const chartMin = useMemo(
    () =>
      chartData.reduce((min, item) => {
        const values = [
          item.revenueActual,
          item.revenueForecast,
          item.expenseActual,
          item.expenseForecast,
          item.cashActual,
          item.cashForecast,
        ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
        return Math.min(min, ...values);
      }, 0),
    [chartData],
  );
  const hasChartValues = chartMax > 0 || chartMin < 0;

  return (
    <div className="space-y-5">
      <Header title={t("fcTitle")} desc={t("fcDesc")} />

      <div className="grid sm:grid-cols-3 gap-3">
        {[
          {
            l: t("predictedRevenue"),
            v: money(firstForecast?.predictedRevenue ?? 0),
            sub: `${formatPercent(forecast?.calculationDetails.revenueGrowthRate ?? 0)} ${l("growth")}`,
            color: "#0F6E56",
          },
          {
            l: t("predictedExpenses"),
            v: money(firstForecast?.predictedExpense ?? 0),
            sub: `${formatPercent(forecast?.calculationDetails.expenseGrowthRate ?? 0)} ${l("growth")}`,
            color: "#993C1D",
          },
          {
            l: t("predictedCash"),
            v: money(cash90),
            sub: l("Revenue - Expenses"),
            color: "var(--on-surface-variant)",
          },
        ].map((s) => (
          <div key={s.l} className="bg-surface-container border border-border-default rounded-lg px-4 py-3">
            <p className="text-xs text-on-surface-variant">{s.l}</p>
            <p className="text-[22px] leading-tight font-medium mt-1">{s.v}</p>
            <p className="text-[11px] mt-1" style={{ color: s.color }}>{s.sub}</p>
          </div>
        ))}
      </div>
   <div className="bg-card border border-border-default rounded-lg p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">{l("Forecast - next 5 months")}</h3>
            {forecast && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#FAEEDA] text-[#854F0B]">
                {forecast.confidence.score}% {l("confidence")}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <ToggleButton active={visibleSeries.revenue} onClick={() => setVisibleSeries((state) => ({ ...state, revenue: !state.revenue }))}>
              {l("Revenue")}
            </ToggleButton>
            <ToggleButton active={visibleSeries.expenses} onClick={() => setVisibleSeries((state) => ({ ...state, expenses: !state.expenses }))}>
              {l("Expenses")}
            </ToggleButton>
            <ToggleButton active={visibleSeries.cashflow} onClick={() => setVisibleSeries((state) => ({ ...state, cashflow: !state.cashflow }))}>
              {l("Cash flow")}
            </ToggleButton>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 mb-3 text-xs text-on-surface-variant">
          <LegendItem color="#1D9E75" label={l("Revenue (actual)")} />
          <LegendItem color="#1D9E75" label={l("Revenue (forecast)")} dashed />
          <LegendItem color="#D85A30" label={l("Expenses (actual)")} />
          <LegendItem color="#378ADD" label={l("Cash flow")} block />
          <LegendItem color="#1D9E75" label={l("Confidence band")} band />
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3.5 w-0.5 rounded-full bg-[#888780]" /> {l("Today")}
          </span>
        </div>

        <div className="h-80 relative">
          {!hasChartValues && (
            <div className="absolute inset-0 z-10 grid place-items-center text-sm text-on-surface-variant">
              {l("No forecast values available yet.")}
            </div>
          )}
          <ForecastSvgChart
            data={chartData}
            visibleSeries={visibleSeries}
            todayKey={todayKey}
            minValue={chartMin}
            maxValue={chartMax}
            todayText={l("Today")}
            ariaLabel={l("Financial forecast chart")}
          />
        </div>

        {forecast && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 rounded-lg bg-surface-container px-4 py-3 text-xs text-on-surface-variant">
            <span><strong className="text-on-surface font-medium">{l("Method")}:</strong> {l(forecast.method.revenue)}</span>
            <span><strong className="text-on-surface font-medium">{l("Periods")}:</strong> {forecast.calculationDetails.historicalPeriodCount} {l("historical")}</span>
            <span><strong className="text-on-surface font-medium">{l("Completeness")}:</strong> {Math.round(forecast.confidence.factors.dataCompleteness * 100)}%</span>
          </div>
        )}
      </div>
      {forecast && (
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-4">
          <div className="bg-card border border-border-default rounded-lg p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{l("Forecast audit trail")}</h3>
                <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
                  {l("Deterministic formula forecast using only this tenant's financial history.")}
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-md bg-[#FAEEDA] text-[#854F0B]">
                {forecast.modelVersion}
              </span>
            </div>
            <div className="grid md:grid-cols-3 gap-3 mt-5">
              <AuditMethod title={l("Revenue")} method={l(forecast.method.revenue)} rate={forecast.calculationDetails.revenueGrowthRate} appliedGrowthLabel={l("applied growth")} />
              <AuditMethod title={l("Expenses")} method={l(forecast.method.expenses)} rate={forecast.calculationDetails.expenseGrowthRate} appliedGrowthLabel={l("applied growth")} />
              <AuditMethod title={l("Cash flow")} method={l(forecast.method.cashflow)} rate={null} appliedGrowthLabel={l("applied growth")} />
            </div>
            <div className="mt-4 rounded-lg bg-surface-container px-4 py-3 space-y-2">
              {forecast.formulaUsed.map((formula) => (
                <p key={formula} className="text-xs leading-relaxed text-on-surface-variant">{l(formula)}</p>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border-default rounded-lg p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">{l("Confidence basis")}</h3>
              <span className="text-xs px-2.5 py-1 rounded-md bg-surface-container">
                {forecast.confidence.score}% {l("confidence")}
              </span>
            </div>
            <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">{formatConfidenceExplanation(forecast, l)}</p>
            <div className="space-y-3 mt-4">
              <ConfidenceRow label={l("Data availability")} value={forecast.confidence.factors.historicalDataAvailability} />
              <ConfidenceRow label={l("Low variance")} value={forecast.confidence.factors.historicalVariance} />
              <ConfidenceRow label={l("Seasonality")} value={forecast.confidence.factors.seasonalConsistency} />
              <ConfidenceRow label={l("Completeness")} value={forecast.confidence.factors.dataCompleteness} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <span className="rounded-md bg-surface-container px-3 py-2">
                <strong className="font-medium text-on-surface">{forecast.calculationDetails.historicalPeriodCount}</strong> {l("periods")}
              </span>
              <span className="rounded-md bg-surface-container px-3 py-2">
                <strong className="font-medium text-on-surface">{forecast.calculationDetails.forecastHorizonMonths}</strong> {l("months forecast")}
              </span>
            </div>
          </div>
        </div>
      )}

   
    </div>
  );
}

function AuditMethod({ title, method, rate, appliedGrowthLabel }: { title: string; method: string; rate: number | null; appliedGrowthLabel: string }) {
  return (
    <div className="rounded-lg border border-border-default p-3">
      <p className="text-xs text-on-surface-variant">{title}</p>
      <p className="text-sm font-medium mt-1 leading-snug">{method}</p>
      {rate !== null && <p className="text-[11px] text-on-surface-variant mt-2">{formatPercent(rate)} {appliedGrowthLabel}</p>}
    </div>
  );
}

function ForecastSvgChart({
  data,
  visibleSeries,
  todayKey,
  minValue,
  maxValue,
  todayText,
  ariaLabel,
}: {
  data: ChartDatum[];
  visibleSeries: { revenue: boolean; expenses: boolean; cashflow: boolean };
  todayKey: string;
  minValue: number;
  maxValue: number;
  todayText: string;
  ariaLabel: string;
}) {
  const width = 1000;
  const height = 300;
  const pad = { top: 18, right: 18, bottom: 34, left: 56 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const domainMin = Math.min(0, Math.floor(minValue * 1.15));
  const domainMax = Math.max(1, Math.ceil(maxValue * 1.15));
  const span = domainMax - domainMin || 1;
  const zeroY = scaleY(0);
  const ticks = makeTicks(domainMin, domainMax);

  function scaleX(index: number) {
    return pad.left + (data.length <= 1 ? 0 : (index / (data.length - 1)) * plotWidth);
  }

  function scaleY(value: number) {
    return pad.top + ((domainMax - value) / span) * plotHeight;
  }

  function point(index: number, value: number) {
    return `${scaleX(index)},${scaleY(value)}`;
  }

  function linePoints(key: keyof ChartDatum) {
    return data
      .map((item, index) => {
        const value = item[key];
        return typeof value === "number" && Number.isFinite(value) ? point(index, value) : null;
      })
      .filter(Boolean)
      .join(" ");
  }

  function forecastLinePoints(forecastKey: keyof ChartDatum, actualKey: keyof ChartDatum) {
    const points = data
      .map((item, index) => {
        const value = item[forecastKey];
        return typeof value === "number" && Number.isFinite(value) ? { index, value } : null;
      })
      .filter((item): item is { index: number; value: number } => Boolean(item));

    if (!points.length) return "";

    const firstForecastIndex = points[0].index;
    const previousActual = [...data]
      .slice(0, firstForecastIndex)
      .map((item, index) => ({ index, value: item[actualKey] }))
      .filter((item): item is { index: number; value: number } => typeof item.value === "number" && Number.isFinite(item.value))
      .pop();

    const connected = previousActual ? [previousActual, ...points] : points;
    return connected.map((item) => point(item.index, item.value)).join(" ");
  }

  function bandPoints(upperKey: keyof ChartDatum, lowerKey: keyof ChartDatum) {
    const upper: string[] = [];
    const lower: string[] = [];
    data.forEach((item, index) => {
      const upperValue = item[upperKey];
      const lowerValue = item[lowerKey];
      if (
        typeof upperValue === "number" &&
        Number.isFinite(upperValue) &&
        typeof lowerValue === "number" &&
        Number.isFinite(lowerValue)
      ) {
        upper.push(point(index, upperValue));
        lower.unshift(point(index, lowerValue));
      }
    });
    return [...upper, ...lower].join(" ");
  }

  function areaToZero(key: keyof ChartDatum) {
    const points: { x: number; y: number }[] = [];
    data.forEach((item, index) => {
      const value = item[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        points.push({ x: scaleX(index), y: scaleY(value) });
      }
    });
    if (!points.length) return "";
    const first = points[0];
    const last = points[points.length - 1];
    return [
      `${first.x},${zeroY}`,
      ...points.map((item) => `${item.x},${item.y}`),
      `${last.x},${zeroY}`,
    ].join(" ");
  }

  const todayIndex = data.findIndex((item) => item.key === todayKey);
  const todayX = todayIndex >= 0 ? scaleX(todayIndex) : null;

  return (
    <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
      {ticks.map((tick) => {
        const y = scaleY(tick);
        return (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="rgba(136,135,128,0.16)" />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="12" fill="#888780">
              {formatAxisMoney(tick)}
            </text>
          </g>
        );
      })}

      {data.map((item, index) => (
        <text key={`${item.key}-${index}`} x={scaleX(index)} y={height - 10} textAnchor="middle" fontSize="12" fill="#888780">
          {item.label}
        </text>
      ))}

      {visibleSeries.cashflow && (
        <>
          <polygon points={areaToZero("cashActual")} fill="rgba(55,138,221,0.08)" />
          <polygon points={areaToZero("cashForecast")} fill="rgba(55,138,221,0.08)" />
        </>
      )}
      {visibleSeries.revenue && <polygon points={bandPoints("revenueUpper", "revenueLower")} fill="rgba(29,158,117,0.13)" />}
      {visibleSeries.expenses && <polygon points={bandPoints("expenseUpper", "expenseLower")} fill="rgba(216,90,48,0.12)" />}

      {todayX !== null && (
        <g>
          <line x1={todayX} x2={todayX} y1={pad.top} y2={height - pad.bottom} stroke="#888780" strokeDasharray="4 4" strokeWidth="1.2" />
          <text x={todayX + 8} y={pad.top - 6} fontSize="11" fill="#888780">{todayText}</text>
        </g>
      )}

      {visibleSeries.revenue && (
        <>
          <polyline points={linePoints("revenueActual")} fill="none" stroke="#1D9E75" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={forecastLinePoints("revenueForecast", "revenueActual")} fill="none" stroke="#1D9E75" strokeWidth="2.4" strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" />
          <ChartDots data={data} dataKey="revenueActual" color="#1D9E75" point={point} />
          <ChartDots data={data} dataKey="revenueForecast" color="#1D9E75" point={point} small />
        </>
      )}
      {visibleSeries.expenses && (
        <>
          <polyline points={linePoints("expenseActual")} fill="none" stroke="#D85A30" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={forecastLinePoints("expenseForecast", "expenseActual")} fill="none" stroke="#D85A30" strokeWidth="2.4" strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" />
          <ChartDots data={data} dataKey="expenseActual" color="#D85A30" point={point} />
          <ChartDots data={data} dataKey="expenseForecast" color="#D85A30" point={point} small />
        </>
      )}
      {visibleSeries.cashflow && (
        <>
          <polyline points={linePoints("cashActual")} fill="none" stroke="#378ADD" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={forecastLinePoints("cashForecast", "cashActual")} fill="none" stroke="#378ADD" strokeWidth="2.4" strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" />
          <ChartDots data={data} dataKey="cashActual" color="#378ADD" point={point} />
          <ChartDots data={data} dataKey="cashForecast" color="#378ADD" point={point} small />
        </>
      )}
    </svg>
  );
}

function ChartDots({
  data,
  dataKey,
  color,
  point,
  small = false,
}: {
  data: ChartDatum[];
  dataKey: keyof ChartDatum;
  color: string;
  point: (index: number, value: number) => string;
  small?: boolean;
}) {
  return (
    <>
      {data.map((item, index) => {
        const value = item[dataKey];
        if (typeof value !== "number" || !Number.isFinite(value)) return null;
        const [cx, cy] = point(index, value).split(",").map(Number);
        return <circle key={`${String(dataKey)}-${index}`} cx={cx} cy={cy} r={small ? 2.6 : 3.4} fill={color} />;
      })}
    </>
  );
}

function ConfidenceRow({ label, value }: { label: string; value: number }) {
  const percent = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-on-surface-variant">{label}</span>
        <span className="font-medium">{percent}%</span>
      </div>
      <div className="h-2 rounded-full bg-surface-container overflow-hidden">
        <div className="h-full rounded-full bg-[#1D9E75]" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
    </div>
  );
}

function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
        active
          ? "bg-surface-container text-on-surface border-border-default font-medium"
          : "bg-transparent text-on-surface-variant border-border-default"
      }`}
    >
      {children}
    </button>
  );
}

function LegendItem({ color, label, dashed = false, block = false, band = false }: { color: string; label: string; dashed?: boolean; block?: boolean; band?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`${band || block ? "h-2.5" : "h-0.5"} w-6 rounded-sm`}
        style={{
          background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 6px, transparent 6px 10px)` : color,
          opacity: band ? 0.35 : block ? 0.65 : 1,
        }}
      />
      {label}
    </span>
  );
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: string, locale: string) {
  return new Date(`${monthKey(date)}-01T00:00:00.000Z`).toLocaleString(locale, { month: "short", year: "2-digit" });
}

function formatConfidenceExplanation(forecast: ForecastResponse, l: (value: string) => string) {
  const score = Math.round(forecast.confidence.score);
  const periods = forecast.calculationDetails.historicalPeriodCount;
  const variance = forecast.confidence.factors.historicalVariance.toFixed(4);
  const seasonal = forecast.confidence.factors.seasonalConsistency.toFixed(4);
  const completeness = forecast.confidence.factors.dataCompleteness.toFixed(4);

  return `${l("Confidence is")} ${score}% ${l("based only on")} ${periods} ${l("tenant historical periods")}, ${variance} ${l("historical variance coefficient")}, ${seasonal} ${l("seasonal consistency")}, ${l("and")} ${completeness} ${l("data completeness")}.`;
}

function formatPercent(value: number) {
  const percent = value * 100;
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(2)}%`;
}

function makeTicks(min: number, max: number) {
  const span = max - min || 1;
  return [0, 0.33, 0.66, 1].map((ratio) => Math.round((min + span * ratio) / 1000) * 1000);
}

function formatAxisMoney(value: number) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}$${abs >= 1000 ? `${Math.round(abs / 1000)}k` : abs}`;
}

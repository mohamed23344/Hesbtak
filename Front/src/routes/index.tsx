import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { BrandMark, LangToggle, ThemeToggle } from "@/components/Brand";
import {
  Sparkles,
  Receipt,
  LineChart,
  ShieldCheck,
  Bot,
  ArrowRight,
  CheckCircle2,
  Zap,
  Globe,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getSession } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hesbetak.AI — AI accounting for small businesses" },
      {
        name: "description",
        content:
          "Bilingual AI-powered accounting platform for SMBs. Automate bookkeeping, get instant financial insights, and manage invoices effortlessly.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t, dir } = useI18n();
  const [loggedIn, setLoggedIn] = useState(false);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    const session = getSession();
    setLoggedIn(!!session);
    setAdmin(session?.user.globalRole === "admin");
  }, []);

  const appTarget = loggedIn ? (admin ? "/admin" : "/dashboard") : "/login";
  const startTarget = loggedIn ? (admin ? "/admin" : "/dashboard") : "/register";

  return (
    <div dir={dir} className="min-h-screen bg-surface text-on-surface">
      {/* Nav */}
      <header className="sticky top-0 z-40 backdrop-blur bg-surface/80 border-b border-border-default">
        <div className="mx-auto max-w-7xl px-4 md:px-6 h-16 flex items-center justify-between">
          <BrandMark />
          <nav className="hidden md:flex items-center gap-6 text-sm text-on-surface-variant">
            <a href="#features" className="hover:text-primary">{t("featuresTitle")}</a>
            <a href="#ai" className="hover:text-primary">{t("astTitle")}</a>
            <a href="#pricing" className="hover:text-primary">{t("ctaTitle")}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
            {loggedIn ? (
              <Link to={appTarget}>
                <Button size="sm" className="bg-gradient-primary gap-2">
                  {t("goToDashboard")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">{t("signIn")}</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="bg-gradient-primary">{t("getStarted")}</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-hero">
        <div className="mx-auto max-w-7xl px-4 md:px-6 pt-20 pb-28 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-surface-container px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> New · GPT-powered insights
            </span>
            <h1 className="mt-5 text-4xl md:text-6xl font-bold tracking-tight text-on-surface leading-[1.05]">
              {t("heroTitle")}
            </h1>
            <p className="mt-5 text-lg text-on-surface-variant max-w-xl">{t("heroSubtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={startTarget}>
                <Button size="lg" className="bg-gradient-primary gap-2">
                  {t("getStarted")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
              </Link>
              <Link to={appTarget}>
                <Button size="lg" variant="outline">{t("seeDemo")}</Button>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-on-surface-variant">
              {["No credit card", "Arabic & English", "Setup in 2 min"].map((x) => (
                <span key={x} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-status-success" /> {x}
                </span>
              ))}
            </div>
          </div>
          <DashboardPreview />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 md:px-6 py-24">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            {t("featuresTitle")}
          </h2>
          <p className="mt-3 text-on-surface-variant">
            {t("featuresSubtitle")}
          </p>
        </div>
        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Receipt,
              title: "Smart invoicing",
              desc: "Create, send, and track invoices in seconds. Status updates automatically when paid.",
            },
            {
              icon: LineChart,
              title: "Live cashflow",
              desc: "Visualize revenue, expenses, and runway with charts that make sense at a glance.",
            },
            {
              icon: Bot,
              title: "OCR receipts",
              desc: "Drop a photo or PDF. We extract the merchant, tax, and category in one click.",
            },
            {
              icon: ShieldCheck,
              title: "Audit-ready ledger",
              desc: "Double-entry journals generated for you. Export to your accountant anytime.",
            },
            {
              icon: Globe,
              title: "Bilingual UI",
              desc: "Full Arabic and English support including RTL layouts and Arabic numerals.",
            },
            {
              icon: Zap,
              title: "Forecasts",
              desc: "Formula-driven cashflow projections use only your own invoices, expenses, bills, and payments.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border-default bg-card p-6 shadow-soft hover:shadow-card transition-shadow"
            >
              <div className="h-10 w-10 rounded-lg bg-surface-container text-primary grid place-items-center">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-on-surface-variant">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI Section */}
      <section id="ai" className="bg-surface-container/60 border-y border-border-default">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-medium text-primary border border-border-default">
              <Bot className="h-3.5 w-3.5" /> {t("astTitle")}
            </span>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
              {t("aiAssistantLabel")}
            </h2>
            <p className="mt-3 text-on-surface-variant max-w-lg">
              {t("aiAssistantDesc")}
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Auto-categorize transactions",
                "Detect duplicate invoices",
                "Suggest tax-saving moves",
                "Explain cash trends from your ledger",
              ].map((x) => (
                <li key={x} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-status-success shrink-0" /> {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-card border border-border-default p-6 shadow-card">
            <div className="space-y-4">
              <ChatBubble who="you">What's my net profit this month?</ChatBubble>
              <ChatBubble who="ai">
                You're at <strong>$12,480</strong> net profit — up 18% vs last month. Revenue grew
                from new invoices to Acme Co. Want me to draft a cashflow forecast?
              </ChatBubble>
              <ChatBubble who="you">Yes, for next 60 days.</ChatBubble>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="mx-auto max-w-5xl px-4 md:px-6 py-24 text-center">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
          {t("ctaTitle")}
        </h2>
        <p className="mt-4 text-on-surface-variant">
          {t("ctaSubtitle")}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to={startTarget}>
            <Button size="lg" className="bg-gradient-primary gap-2">
              {t("getStarted")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-default bg-card">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <BrandMark />
          <p className="text-sm text-on-surface-variant">
            © {new Date().getFullYear()} Hesbetak.AI — Built for SMBs.
          </p>
          <div className="flex gap-4 text-sm text-on-surface-variant">
            <a href="#" className="hover:text-primary">Privacy</a>
            <a href="#" className="hover:text-primary">Terms</a>
            <a href="#" className="hover:text-primary">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ChatBubble({ who, children }: { who: "you" | "ai"; children: React.ReactNode }) {
  const isYou = who === "you";
  return (
    <div className={`flex ${isYou ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
          isYou
            ? "bg-gradient-primary text-primary-foreground"
            : "bg-surface-container text-on-surface"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-gradient-primary opacity-20 blur-3xl rounded-3xl" />
      <div className="relative rounded-2xl bg-card border border-border-default shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-on-surface-variant">Total Revenue</p>
            <p className="text-2xl font-bold text-on-surface">$48,250</p>
          </div>
          <span className="text-xs font-medium text-status-success bg-status-success/10 px-2 py-1 rounded-full">
            +12.4%
          </span>
        </div>
        <div className="h-32 flex items-end gap-2">
          {[40, 65, 50, 80, 60, 90, 75, 95, 70, 88, 92, 100].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-md bg-gradient-to-t from-primary to-accent"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          {[
            { label: "Invoices", val: "24" },
            { label: "Expenses", val: "$8.2k" },
            { label: "Cash", val: "$32k" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-surface-container p-3">
              <p className="text-xs text-on-surface-variant">{s.label}</p>
              <p className="font-semibold mt-0.5">{s.val}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

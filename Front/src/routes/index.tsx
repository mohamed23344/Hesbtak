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
      <header className="sticky top-0 z-40 backdrop-blur-md bg-surface/75 border-b border-border-default/60">
        <div className="mx-auto max-w-[1200px] px-5 md:px-8 h-16 flex items-center justify-between">
          <BrandMark />
          <nav className="hidden md:flex items-center gap-6 text-sm text-on-surface-variant font-medium">
            <a href="#features" className="hover:text-primary transition-colors">{t("featuresTitle")}</a>
            <a href="#ai" className="hover:text-primary transition-colors">{t("astTitle")}</a>
            <a href="#pricing" className="hover:text-primary transition-colors">{t("ctaTitle")}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
            {loggedIn ? (
              <Link to={appTarget}>
                <Button size="sm" className="bg-gradient-primary gap-2 cursor-pointer shadow-soft hover-glow">
                  {t("goToDashboard")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="cursor-pointer">{t("signIn")}</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="bg-gradient-primary cursor-pointer shadow-soft hover-glow">{t("getStarted")}</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-hero relative overflow-hidden">
        {/* Decorative background glows */}
        <div className="absolute top-20 right-10 w-72 h-72 bg-accent/10 blur-3xl rounded-full" />
        <div className="absolute bottom-10 left-10 w-72 h-72 bg-primary/10 blur-3xl rounded-full" />

        <div className="mx-auto max-w-[1200px] min-h-[calc(100vh-5rem)] px-5 md:px-8 py-12 grid lg:grid-cols-[1fr_1fr] gap-12 items-center relative z-10">
          <div>
            <span className="inline-flex items-center gap-2.5 rounded-full bg-primary/10 border border-primary/20 px-4 py-2 text-sm font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" /> New · GPT-powered insights
            </span>
            <h1 className="mt-6 text-4xl md:text-6xl lg:text-7xl font-bold tracking-[-0.04em] text-on-surface leading-[1.05]">
              {t("heroTitle")}
            </h1>
            <p className="mt-5 text-lg md:text-xl text-on-surface-variant max-w-xl leading-relaxed">{t("heroSubtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={startTarget}>
                <Button size="lg" className="bg-gradient-primary gap-2 cursor-pointer shadow-card hover-glow">
                  {t("getStarted")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
              </Link>
              <Link to={appTarget}>
                <Button size="lg" variant="outline" className="cursor-pointer hover:bg-surface-container/50">{t("seeDemo")}</Button>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-on-surface-variant">
              {["No credit card", "Arabic & English", "Setup in 2 min"].map((x) => (
                <span key={x} className="inline-flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-status-success" /> {x}
                </span>
              ))}
            </div>
          </div>
          <DashboardPreview />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-[1200px] px-5 md:px-8 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            {t("featuresTitle")}
          </h2>
          <p className="mt-4 text-on-surface-variant text-lg">
            {t("featuresSubtitle")}
          </p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
              className="rounded-2xl border border-border-default bg-card/60 glass-panel p-6 shadow-soft hover-glow transition-all duration-300 group"
            >
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center transition-transform group-hover:scale-105">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-bold text-lg">{f.title}</h3>
              <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI Section */}
      <section id="ai" className="bg-surface-container/40 border-y border-border-default/60 relative overflow-hidden">
        {/* Soft decorative glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 blur-3xl rounded-full" />

        <div className="mx-auto max-w-[1200px] px-5 md:px-8 py-20 grid lg:grid-cols-2 gap-12 items-center relative z-10">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-card border border-border-default px-3 py-1 text-xs font-semibold text-primary shadow-soft">
              <Bot className="h-3.5 w-3.5" /> {t("astTitle")}
            </span>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight leading-tight">
              {t("aiAssistantLabel")}
            </h2>
            <p className="mt-4 text-on-surface-variant text-base leading-relaxed max-w-xl">
              {t("aiAssistantDesc")}
            </p>
            <ul className="mt-5 space-y-2">
              {[
                "Auto-categorize transactions",
                "Detect duplicate invoices",
                "Suggest tax-saving moves",
                "Explain cash trends from your ledger",
              ].map((x) => (
                <li key={x} className="flex items-center gap-3 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" /> {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-card/70 glass-panel p-6 shadow-card hover-glow transition-all duration-300">
            <div className="space-y-3">
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
      <section id="pricing" className="mx-auto max-w-4xl px-5 md:px-8 py-20 text-center relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-accent/10 blur-3xl rounded-full -z-10" />
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
          {t("ctaTitle")}
        </h2>
        <p className="mt-4 text-on-surface-variant text-base max-w-lg mx-auto">
          {t("ctaSubtitle")}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to={startTarget}>
            <Button size="lg" className="bg-gradient-primary gap-2 cursor-pointer shadow-card hover-glow">
              {t("getStarted")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-default/60 bg-card/65 backdrop-blur-sm">
        <div className="mx-auto max-w-[1200px] px-5 md:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <BrandMark />
          <p className="text-sm text-on-surface-variant font-medium">
            © {new Date().getFullYear()} Hesbetak.AI — Built for SMBs.
          </p>
          <div className="flex gap-6 text-sm text-on-surface-variant font-medium">
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms</a>
            <a href="#" className="hover:text-primary transition-colors">Contact</a>
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
        className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-base ${
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
      <div className="absolute -inset-4 bg-gradient-primary opacity-20 blur-3xl rounded-2xl" />
      <div className="relative rounded-2xl bg-card border border-border-default shadow-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-on-surface-variant">Total Revenue</p>
            <p className="text-2xl font-bold text-on-surface">$48,250</p>
          </div>
          <span className="text-xs font-medium text-status-success bg-status-success/10 px-2 py-1 rounded-full">
            +12.4%
          </span>
        </div>
        <div className="h-36 flex items-end gap-2">
          {[40, 65, 50, 80, 60, 90, 75, 95, 70, 88, 92, 100].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-md bg-gradient-to-t from-primary to-accent"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Invoices", val: "24" },
            { label: "Expenses", val: "$8.2k" },
            { label: "Cash", val: "$32k" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-surface-container p-2">
              <p className="text-xs text-on-surface-variant">{s.label}</p>
              <p className="font-semibold mt-0.5 text-sm">{s.val}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

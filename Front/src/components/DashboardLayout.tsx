import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { BrandMark, LangToggle, ThemeToggle } from "@/components/Brand";
import {
  LayoutDashboard, ArrowLeftRight, Receipt, ShoppingCart, Wallet,
  Network, BookOpenText, Bot, TrendingUp, Bell, Settings, Search, LogOut, Menu, X,
  ChartNoAxesCombined, ChevronDown, ChevronRight, LifeBuoy,
} from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { clearSession, getSession, updateSession } from "@/lib/api";

type NavItem = {
  to: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  permission?: string;
};

type NavSection = {
  key: string;
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  items: NavItem[];
};

export default function DashboardLayout() {
  const { t, dir } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const session = getSession();
  const activeTenant = session?.tenants.find((tenant) => tenant.organizationId === session.activeTenantId);
  const features = activeTenant?.subscription?.plan.features ?? {};

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isChildActive = (items: NavItem[]) =>
    items.some((item) => path === item.to || path.startsWith(item.to + "/"));

  const topNav: NavItem[] = [
    { to: "/dashboard", label: t("dashboard"), icon: LayoutDashboard, permission: "dashboard" },
    { to: "/dashboard/transactions", label: t("transactions"), icon: ArrowLeftRight, permission: "accounting" },
  ].filter((item) => {
    if (item.permission === "assistant" && !features.chatbot) return false;
    return activeTenant?.role !== "viewer" || activeTenant.permissions?.includes(item.permission);
  });

  const sections: NavSection[] = [
    {
      key: "sales",
      to: "/dashboard/sales/manage",
      label: t("sales"),
      icon: Receipt,
      permission: "invoices",
      items: [
        { to: "/dashboard/sales/manage", label: t("manageInvoices") },
        { to: "/dashboard/sales/payments", label: t("payments") },
        { to: "/dashboard/sales/customers", label: t("customers") },
        { to: "/dashboard/sales/returns", label: t("returns") },
      ],
    },
    {
      key: "purchases",
      to: "/dashboard/purchases/manage",
      label: t("purchases"),
      icon: ShoppingCart,
      permission: "invoices",
      items: [
        { to: "/dashboard/purchases/manage", label: t("manageInvoices") },
        { to: "/dashboard/purchases/payments", label: t("payments") },
        { to: "/dashboard/purchases/vendors", label: t("vendors") },
        { to: "/dashboard/purchases/returns", label: t("returns") },
      ],
    },
    {
      key: "expenses",
      to: "/dashboard/expenses/manage",
      label: t("expenses"),
      icon: Wallet,
      permission: "invoices",
      items: [
        { to: "/dashboard/expenses/manage", label: t("manageInvoices") },
        { to: "/dashboard/expenses/payments", label: t("payments") },
        { to: "/dashboard/expenses/vendors", label: t("vendors") },
        { to: "/dashboard/expenses/returns", label: t("returns") },
      ],
    },
  ].filter((section) => {
    if (section.permission === "assistant" && !features.chatbot) return false;
    return activeTenant?.role !== "viewer" || activeTenant.permissions?.includes(section.permission);
  });

  const bottomNav: NavItem[] = [
    { to: "/dashboard/accounts", label: t("accounts"), icon: Network, permission: "accounts" },
    { to: "/dashboard/journal", label: t("journal"), icon: BookOpenText, permission: "journal" },
    { to: "/dashboard/assistant", label: t("assistant"), icon: Bot, permission: "assistant" },
    { to: "/dashboard/forecasting", label: t("forecasting"), icon: TrendingUp, permission: "forecasting" },
    { to: "/dashboard/reports", label: t("reports"), icon: ChartNoAxesCombined, permission: "reports" },
    { to: "/dashboard/notifications", label: t("notifications"), icon: Bell, permission: "notifications" },
    { to: "/dashboard/support", label: t("support"), icon: LifeBuoy },
    { to: "/dashboard/settings", label: t("settings"), icon: Settings, permission: "settings" },
  ].filter((item) => {
    if (item.permission === "assistant" && !features.chatbot) return false;
    return !item.permission || activeTenant?.role !== "viewer" || activeTenant.permissions?.includes(item.permission);
  });

  const navLinkClass = (active: boolean) =>
    `flex items-center gap-3.5 px-4 py-2.5 text-base transition-all duration-250 ${
      active
        ? "bg-primary/8 text-primary font-semibold border-s-2 border-primary rounded-s-none rounded-e-lg"
        : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface rounded-lg"
    }`;

  return (
    <div dir={dir} className="min-h-screen flex bg-surface">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 z-40 h-screen w-72 bg-card border-e border-border-default flex flex-col transition-transform ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0 rtl:translate-x-full rtl:lg:translate-x-0"
        }`}
      >
        <div className="h-20 flex items-center justify-between px-5 border-b border-border-default">
          <BrandMark to="/dashboard" />
          <button onClick={() => setOpen(false)} className="lg:hidden text-on-surface-variant focus:outline-none">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3.5 space-y-1">
          {topNav.map((item) => {
            const active = path === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={navLinkClass(active)}
              >
                {item.icon && <item.icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-105" />}
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          {/* Separator */}
          <div className="my-2 border-t border-border-default" />

          {sections.map((section) => {
            const expanded = expandedSections[section.key] ?? isChildActive(section.items);
            const Icon = section.icon;
            return (
              <div key={section.key} className="space-y-0.5">
                <div
                  className={`w-full flex items-center gap-3.5 px-4 py-2.5 text-base transition-all duration-200 ${
                    isChildActive(section.items)
                      ? "text-primary font-semibold"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface rounded-lg"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <Link
                    to={section.to}
                    onClick={() => setOpen(false)}
                    className="min-w-0 flex-1 truncate text-start"
                  >
                    {section.label}
                  </Link>
                  <button
                    type="button"
                    aria-label={`${expanded ? "Collapse" : "Expand"} ${section.label}`}
                    onClick={() => toggleSection(section.key)}
                    className="rounded-md p-1 hover:bg-primary/10"
                  >
                    {expanded ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 rtl:rotate-180" />
                    )}
                  </button>
                </div>
                {expanded && (
                  <div className="ms-3 border-s border-border-default/80 ps-2 mt-0.5 space-y-0.5">
                    {section.items.map((item) => {
                      const active = path === item.to;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2 text-[0.94rem] transition-all duration-200 ${
                            active
                              ? "bg-primary/8 text-primary font-semibold border-s border-primary rounded-s-none rounded-e-lg"
                              : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface rounded-lg"
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Separator */}
          <div className="my-2 border-t border-border-default" />

          {bottomNav.map((item) => {
            const active = path === item.to || (item.to !== "/dashboard" && path.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={navLinkClass(active)}
              >
                {item.icon && <item.icon className="h-5 w-5 shrink-0" />}
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border-default p-3">
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-surface-container/60 p-2 lg:hidden">
            <LangToggle />
            <ThemeToggle />
          </div>
          <Link
            to="/login"
            onClick={() => clearSession()}
            className="flex items-center gap-3.5 rounded-lg px-4 py-2.5 text-base text-on-surface-variant hover:bg-destructive/10 hover:text-destructive transition-colors duration-200"
          >
            <LogOut className="h-5 w-5" /> {t("logout")}
          </Link>
        </div>
      </aside>

      {/* Overlay */}
      {open && (
        <div onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/40 lg:hidden" />
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-20 sticky top-0 z-20 bg-surface/80 backdrop-blur border-b border-border-default px-4 md:px-7 flex items-center gap-4">
          <button onClick={() => setOpen(true)} className="lg:hidden text-on-surface-variant">
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative min-w-0 flex-1 w-full lg:max-w-xl">
            <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <Input placeholder={t("search")} className="ps-9 bg-card" />
          </div>
          <div className="ms-auto flex shrink-0 items-center gap-2">
            {(session?.tenants.length ?? 0) > 1 && (
              <select
                aria-label="Switch organization"
                value={session?.activeTenantId ?? ""}
                onChange={(event) => {
                  updateSession({ activeTenantId: event.target.value });
                  window.location.assign("/dashboard");
                }}
                className="hidden md:block h-9 max-w-52 rounded-md border border-input bg-background px-2 text-sm"
              >
                {session?.tenants.map((tenant) => <option key={tenant.organizationId} value={tenant.organizationId}>{tenant.organizationName}</option>)}
              </select>
            )}
            <div className="hidden lg:flex items-center gap-2">
              <LangToggle />
              <ThemeToggle />
            </div>
            <Button asChild variant="ghost" size="icon">
              <Link to="/dashboard/notifications" aria-label={t("notifications")}>
                <Bell className="h-4 w-4" />
              </Link>
            </Button>
            <div className="hidden sm:block text-end">
              <p className="text-sm font-medium leading-tight">{session?.user.fullName ?? "Account"}</p>
              <p className="text-xs text-on-surface-variant leading-tight">{activeTenant?.organizationName ?? "Onboarding"}</p>
            </div>
            <div className="hidden sm:grid h-11 w-11 rounded-full bg-gradient-primary text-primary-foreground place-items-center text-base font-semibold">
              {session?.user.fullName?.[0] ?? "A"}
            </div>
          </div>
        </header>
        <main className="flex-1 p-5 md:p-8 max-w-[1840px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

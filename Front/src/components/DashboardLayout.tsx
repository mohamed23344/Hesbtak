import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { BrandMark, LangToggle, ThemeToggle } from "@/components/Brand";
import {
  LayoutDashboard, ArrowLeftRight, FileText, Network,
  BookOpenText, Bot, TrendingUp, ScanLine, Bell, Settings, Search, LogOut, Menu, X,
  ChartNoAxesCombined,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { clearSession, getSession, updateSession } from "@/lib/api";

export default function DashboardLayout() {
  const { t, dir } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const session = getSession();
  const activeTenant = session?.tenants.find((tenant) => tenant.organizationId === session.activeTenantId);

  useEffect(() => {
    if (session?.user.globalRole === "admin") {
      window.location.replace("/admin#users");
    }
  }, [session?.user.globalRole]);

  const NAV = [
    { to: "/dashboard", label: t("dashboard"), icon: LayoutDashboard, permission: "dashboard" },
    { to: "/dashboard/transactions", label: t("transactions"), icon: ArrowLeftRight, permission: "accounting" },
    { to: "/dashboard/invoices", label: t("invoices"), icon: FileText, permission: "invoices" },
    { to: "/dashboard/accounts", label: t("accounts"), icon: Network, permission: "accounts" },
    { to: "/dashboard/journal", label: t("journal"), icon: BookOpenText, permission: "journal" },
    { to: "/dashboard/assistant", label: t("assistant"), icon: Bot, permission: "assistant" },
    { to: "/dashboard/forecasting", label: t("forecasting"), icon: TrendingUp, permission: "forecasting" },
    { to: "/dashboard/reports", label: t("reports"), icon: ChartNoAxesCombined, permission: "reports" },
    { to: "/dashboard/ocr", label: t("ocr"), icon: ScanLine, permission: "ocr" },
    { to: "/dashboard/notifications", label: t("notifications"), icon: Bell, permission: "notifications" },
    { to: "/dashboard/settings", label: t("settings"), icon: Settings, permission: "settings" },
  ].filter((item) =>
    activeTenant?.role !== "viewer" || activeTenant.permissions?.includes(item.permission),
  );

  return (
    <div dir={dir} className="min-h-screen flex bg-surface">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 z-40 h-screen w-64 bg-card border-e border-border-default flex flex-col transition-transform ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0 rtl:translate-x-full rtl:lg:translate-x-0"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-border-default">
          <BrandMark to="/dashboard" />
          <button onClick={() => setOpen(false)} className="lg:hidden text-on-surface-variant">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV.map((item) => {
            const active = path === item.to || (item.to !== "/dashboard" && path.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border-default p-3">
          <Link
            to="/login"
            onClick={() => clearSession()}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-container"
          >
            <LogOut className="h-4 w-4" /> {t("logout")}
          </Link>
        </div>
      </aside>

      {/* Overlay */}
      {open && (
        <div onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/40 lg:hidden" />
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 sticky top-0 z-20 bg-surface/80 backdrop-blur border-b border-border-default px-4 md:px-6 flex items-center gap-3">
          <button onClick={() => setOpen(true)} className="lg:hidden text-on-surface-variant">
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <Input placeholder={t("search")} className="ps-9 bg-card" />
          </div>
          <div className="ms-auto flex items-center gap-2">
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
            <LangToggle />
            <ThemeToggle />
            <Button variant="ghost" size="icon">
              <Bell className="h-4 w-4" />
            </Button>
            <div className="hidden sm:block text-end">
              <p className="text-sm font-medium leading-tight">{session?.user.fullName ?? "Account"}</p>
              <p className="text-xs text-on-surface-variant leading-tight">{activeTenant?.organizationName ?? "Onboarding"}</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-primary text-primary-foreground grid place-items-center text-sm font-semibold">
              {session?.user.fullName?.[0] ?? "A"}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

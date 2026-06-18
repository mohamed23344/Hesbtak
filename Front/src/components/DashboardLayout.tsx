import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { BrandMark, LangToggle, ThemeToggle } from "@/components/Brand";
import {
  LayoutDashboard, ArrowLeftRight, Receipt, ShoppingCart, Wallet,
  Bell, Settings, LogOut, Menu, X, ChevronDown, ChevronRight, Sparkles,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { api, clearSession, getSession, updateSession } from "@/lib/api";
import { toast } from "sonner";

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

type Notification = {
  id: string;
  title?: string;
  message?: string;
  source?: "user" | "tenant";
  isRead?: boolean;
  is_read?: boolean;
};

export default function DashboardLayout() {
  const { t, dir } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef(path);
  const notificationPollReadyRef = useRef(false);
  const unreadNotificationIdsRef = useRef<Set<string>>(new Set());
  const session = getSession();
  const activeTenant = session?.tenants.find((tenant) => tenant.organizationId === session.activeTenantId);
  const features = activeTenant?.subscription?.plan.features ?? {};

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  useEffect(() => {
    let cancelled = false;
    const loadUnreadNotifications = async () => {
      try {
        const [userResult, tenantResult] = await Promise.allSettled([
          api<Notification[]>("/auth/notifications"),
          api<Notification[]>("/tenant/alerts"),
        ]);
        const userNotifications = userResult.status === "fulfilled"
          ? userResult.value.map((item) => ({ ...item, source: "user" as const }))
          : [];
        const tenantAlerts = tenantResult.status === "fulfilled"
          ? tenantResult.value.map((item) => ({ ...item, source: "tenant" as const }))
          : [];
        const notifications = [...userNotifications, ...tenantAlerts];
        if (!cancelled) {
          const unread = notifications.filter((item) => !(item.isRead ?? item.is_read));
          const nextUnreadIds = new Set(unread.map((item) => `${item.source}:${item.id}`));
          const newUnread = unread.filter((item) => !unreadNotificationIdsRef.current.has(`${item.source}:${item.id}`));

          setUnreadNotifications(unread.length);
          if (
            notificationPollReadyRef.current
            && newUnread.length > 0
            && pathRef.current !== "/dashboard/notifications"
          ) {
            const newest = newUnread[0];
            toast.info(newUnread.length === 1 ? (newest.title ?? "New notification") : `${newUnread.length} new notifications`, {
              description: newest.message ?? "Open notifications to review it.",
              
            });
          }

          unreadNotificationIdsRef.current = nextUnreadIds;
          notificationPollReadyRef.current = true;
        }
      } catch {
        if (!cancelled) setUnreadNotifications(0);
      }
    };
    void loadUnreadNotifications();
    const interval = window.setInterval(() => void loadUnreadNotifications(), 10000);
    window.addEventListener("notifications:updated", loadUnreadNotifications);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("notifications:updated", loadUnreadNotifications);
    };
  }, []);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isChildActive = (items: NavItem[]) =>
    items.some((item) => path === item.to || path.startsWith(item.to + "/"));

  const topNav: NavItem[] = [
    { to: "/dashboard", label: t("dashboard"), icon: LayoutDashboard, permission: "dashboard" },
  ].filter((item) => {
    return activeTenant?.role !== "viewer" || activeTenant.permissions?.includes(item.permission);
  });

  const aiItems: NavItem[] = [
    { to: "/dashboard/assistant", label: t("assistant"), permission: "assistant" },
    { to: "/dashboard/forecasting", label: t("forecasting"), permission: "forecasting" },
    { to: "/dashboard/reports", label: t("reports"), permission: "reports" },
  ].filter((item) => {
    if (item.permission === "assistant" && !features.chatbot) return false;
    return !item.permission || activeTenant?.role !== "viewer" || activeTenant.permissions?.includes(item.permission);
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
        // { to: "/dashboard/sales/returns", label: t("returns") },
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
        // { to: "/dashboard/purchases/returns", label: t("returns") },
      ],
    },
    {
      key: "expenses",
      to: "/dashboard/expenses/manage",
      label: t("expenses"),
      icon: Wallet,
      permission: "invoices",
      items: [
        { to: "/dashboard/expenses/manage", label: t("manageExpenses") },
        { to: "/dashboard/expenses/vendors", label: t("vendors") },
      ],
    },
    {
      key: "accounting",
      to: "/dashboard/accounts",
      label: t("accounting"),
      icon: ArrowLeftRight,
      permission: "accounting",
      items: [
        { to: "/dashboard/accounts", label: t("chartOfAccounts") },
        { to: "/dashboard/journal", label: t("journalEntries") },
        { to: "/dashboard/transactions", label: t("generalLedger") },
      ],
    },
    ...(aiItems.length > 0
      ? [{
          key: "ai",
          to: aiItems[0].to,
          label: t("aiInsights"),
          icon: Sparkles,
          items: aiItems,
        }]
      : []),
  ].filter((section) => {
    if (section.key === "ai") return true;
    return activeTenant?.role !== "viewer" || activeTenant.permissions?.includes(section.permission);
  });

  const navLinkClass = (active: boolean) =>
    `flex items-center gap-3.5 px-4 py-2.5 text-base transition-all duration-250 ${
      active
        ? "bg-primary/8 text-primary font-semibold border-s-2 border-primary rounded-s-none rounded-e-lg"
        : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface rounded-lg"
    }`;

  const planName = activeTenant?.subscription?.plan?.name ?? "Free";

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
                {item.icon && <item.icon className="h-5 w-5 shrink-0" />}
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          <div className="my-2 border-t border-border-default" />

          {sections.map((section, idx) => {
            const expanded = expandedSections[section.key] ?? isChildActive(section.items);
            const Icon = section.icon;
            return (
              <div key={section.key}>
                <div className="space-y-0.5">
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
                {idx < sections.length - 1 && (
                  <div className="my-2 border-t border-border-default" />
                )}
              </div>
            );
          })}
        </nav>

        {/* NEW: Mobile organization selector - visible only on small screens */}
        {(session?.tenants.length ?? 0) > 1 && (
          <div className="border-t border-border-default p-3 lg:hidden">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-on-surface-variant">Organization:</span>
              <select
                aria-label="Switch organization"
                value={session?.activeTenantId ?? ""}
                onChange={(event) => {
                  updateSession({ activeTenantId: event.target.value });
                  window.location.assign("/dashboard");
                }}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {session?.tenants.map((tenant) => (
                  <option key={tenant.organizationId} value={tenant.organizationId}>
                    {tenant.organizationName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="border-t border-border-default p-3">
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

          <div className="flex items-center gap-4 w-full">
            {/* Organization selector - hidden on small screens */}
            {(session?.tenants.length ?? 0) > 1 && (
              <div className="hidden md:flex items-center gap-2">
                <span className="text-sm font-medium text-on-surface-variant">Organization:</span>
                <select
                  aria-label="Switch organization"
                  value={session?.activeTenantId ?? ""}
                  onChange={(event) => {
                    updateSession({ activeTenantId: event.target.value });
                    window.location.assign("/dashboard");
                  }}
                  className="h-9 w-64 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {session?.tenants.map((tenant) => (
                    <option key={tenant.organizationId} value={tenant.organizationId}>
                      {tenant.organizationName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Right side group */}
            <div className="flex items-center gap-4 ml-auto">
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="icon">
                  <Link to="/dashboard/notifications" aria-label={t("notifications")} className="relative">
                    <Bell className="h-4 w-4" />
                    {unreadNotifications > 0 && (
                      <span className="absolute -right-1 -top-1 min-w-4 h-4 rounded-full bg-red-600 px-1 text-[10px] leading-4 text-white text-center font-bold">
                        {unreadNotifications > 99 ? "99+" : unreadNotifications}
                      </span>
                    )}
                  </Link>
                </Button>
                {/* Settings button is commented out; using dropdown entry instead */}
              </div>

              {/* Avatar dropdown */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="hidden sm:grid h-11 w-11 rounded-full bg-gradient-primary text-primary-foreground place-items-center text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {session?.user.fullName?.[0] ?? "A"}
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-border-default bg-card shadow-lg p-2 z-50">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium">{session?.user.fullName ?? "Account"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{planName} Plan</p>
                    </div>
                    <div className="my-1 border-t border-border-default" />
                    <div className="px-2 py-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>Appearances</span>
                        <ThemeToggle />
                      </div>
                    </div>
                    <div className="px-2 py-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>Language</span>
                        <LangToggle />
                      </div>
                    </div>

                    <Link
                      to="/dashboard/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-surface-container transition-colors w-full mt-1"
                    >
                      <Settings className="h-4 w-4" />
                      {t("settings")}
                    </Link>

                    <div className="my-1 border-t border-border-default" />
                    <button
                      onClick={() => {
                        clearSession();
                        window.location.href = "/login";
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
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

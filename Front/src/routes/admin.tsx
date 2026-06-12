import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { BrandMark, LangToggle, ThemeToggle } from "@/components/Brand";
import { BadgeCheck, BarChart3, Building, LifeBuoy, LogOut, Menu, ShieldAlert, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { clearSession, getSession } from "@/lib/api";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

const ADMIN_SECTIONS = [
  { id: "users", label: "Users", icon: Users },
  { id: "organizations", label: "Organizations", icon: Building },
  { id: "insights", label: "Usage & Insights", icon: BarChart3 },
  { id: "plans", label: "Plans", icon: BadgeCheck },
  { id: "tickets", label: "Support Tickets", icon: LifeBuoy },
] as const;

function AdminLayout() {
  const { t, dir } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const session = getSession();
  const [section, setSection] = useState(() =>
    typeof window === "undefined" ? "users" : window.location.hash.replace("#", "") || "users"
  );

  useEffect(() => {
    if (!session) {
      window.location.replace("/login");
      return;
    }
    if (session.user.globalRole !== "admin") {
      window.location.replace("/dashboard");
    }
  }, [session]);

  useEffect(() => {
    const syncSection = () => setSection(window.location.hash.replace("#", "") || "users");
    syncSection();
    window.addEventListener("hashchange", syncSection);
    return () => window.removeEventListener("hashchange", syncSection);
  }, []);

  return (
    <div dir={dir} className="min-h-screen flex bg-surface">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 z-40 h-screen w-72 bg-card border-e border-border-default flex flex-col transition-transform ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0 rtl:translate-x-full rtl:lg:translate-x-0"
        }`}
      >
        <div className="h-20 flex items-center justify-between px-5 border-b border-border-default">
          <BrandMark />
          <button onClick={() => setOpen(false)} className="lg:hidden text-on-surface-variant">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 bg-status-error/10 border-b border-status-error/20 flex items-center gap-2 text-status-error">
          <ShieldAlert className="h-5 w-5" />
          <span className="font-semibold text-sm">Admin Portal</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {ADMIN_SECTIONS.map((item) => {
            const active = path.startsWith("/admin") && section === item.id;
            return (
              <a
                key={item.id}
                href={`/admin#${item.id}`}
                onClick={() => {
                  setSection(item.id);
                  setOpen(false);
                }}
                className={`flex items-center gap-3.5 rounded-lg px-4 py-2.5 text-base transition ${
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </a>
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
        <header className="h-20 sticky top-0 z-20 bg-surface/80 backdrop-blur border-b border-border-default px-4 md:px-7 flex items-center justify-between">
          <button onClick={() => setOpen(true)} className="lg:hidden text-on-surface-variant">
            <Menu className="h-5 w-5" />
          </button>
          
          <div className="flex-1" />
          
          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
            <div className="ms-2 h-9 w-9 rounded-full bg-status-error text-white grid place-items-center text-sm font-semibold shadow-soft">
              AD
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

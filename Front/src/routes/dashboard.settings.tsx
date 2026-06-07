import { createFileRoute } from "@tanstack/react-router";
import { Header } from "./dashboard.transactions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useI18n, type Lang } from "@/lib/i18n";
import { useTheme, type Theme } from "@/lib/theme";
import { getSession } from "@/lib/api";

export const Route = createFileRoute("/dashboard/settings")({ component: Page });

function Page() {
  const { lang, setLang, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const session = getSession();
  const tenant = session?.tenants.find((item) => item.organizationId === session.activeTenantId) ?? session?.tenants[0];
  
  return (
    <div className="space-y-5">
      <Header title={t("settings")} desc={t("settingsDesc")} />

      <Section title="Profile">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t("fullName")} defaultValue={session?.user.fullName ?? ""} />
          <Field label={t("email")} defaultValue={session?.user.email ?? ""} />
          <Field label="Global role" defaultValue={session?.user.globalRole ?? "user"} />
          <Field label="Email verified" defaultValue={session?.user.emailVerifiedAt ? "Yes" : "No"} />
        </div>
      </Section>

      <Section title={t("companyTitle")}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t("companyName")} defaultValue={tenant?.organizationName ?? ""} />
          <Field label="Industry" defaultValue={tenant?.industry ?? ""} />
          <Field label={t("defaultCurrency")} defaultValue={tenant?.currency ?? ""} />
          <Field label="Tenant role" defaultValue={tenant?.role ?? ""} />
        </div>
      </Section>

      <Section title={t("languageTitle")}>
        <div className="flex gap-2">
          {(["en", "ar"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-4 py-2 rounded-lg border text-sm ${
                lang === l ? "border-primary bg-primary/5 text-primary font-medium" : "border-border-default"
              }`}
            >
              {l === "en" ? "English" : "Arabic"}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t("themeTitle")}>
        <div className="flex gap-2">
          {(["light", "dark", "system"] as Theme[]).map((th) => (
            <button
              key={th}
              onClick={() => setTheme(th)}
              className={`px-4 py-2 rounded-lg border text-sm capitalize ${
                theme === th ? "border-primary bg-primary/5 text-primary font-medium" : "border-border-default"
              }`}
            >
              {th === "light" ? t("themeLight") : th === "dark" ? t("themeDark") : t("themeSystem")}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t("teamMembers")}>
        <div className="space-y-2">
          {session ? (
            <div className="flex items-center justify-between p-3 rounded-lg border border-border-default">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-gradient-primary text-primary-foreground grid place-items-center text-sm font-semibold">
                  {session.user.fullName[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">{session.user.fullName}</p>
                  <p className="text-xs text-on-surface-variant">{session.user.email}</p>
                </div>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-surface-container">{tenant?.role ?? session.user.globalRole}</span>
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">No active session.</p>
          )}
          <Button variant="outline" className="w-full">+ {t("inviteMember")}</Button>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border-default rounded-2xl p-5 shadow-soft">
      <h3 className="font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input defaultValue={defaultValue} readOnly />
    </div>
  );
}

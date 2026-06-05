import { createFileRoute } from "@tanstack/react-router";
import { Header } from "./dashboard.transactions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useI18n, type Lang } from "@/lib/i18n";
import { useTheme, type Theme } from "@/lib/theme";

export const Route = createFileRoute("/dashboard/settings")({ component: Page });

function Page() {
  const { lang, setLang, t } = useI18n();
  const { theme, setTheme } = useTheme();
  
  return (
    <div className="space-y-5">
      <Header title={t("settings")} desc={t("settingsDesc")} />

      <Section title={t("companyTitle")}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t("companyName")} defaultValue="Acme LLC" />
          <Field label={t("taxId")} defaultValue="123456789" />
          <Field label={t("address")} defaultValue="123 Market St, Cairo" />
          <Field label={t("defaultCurrency")} defaultValue="USD" />
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
              {l === "en" ? "English" : "العربية"}
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
          {[
            { n: "Ahmad Hassan", e: "ahmad@acme.com", role: t("roleOwner") },
            { n: "Sara Mohamed", e: "sara@acme.com", role: t("roleAccountant") },
            { n: "Omar Ali", e: "omar@acme.com", role: t("roleViewer") },
          ].map((u) => (
            <div key={u.e} className="flex items-center justify-between p-3 rounded-lg border border-border-default">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-gradient-primary text-primary-foreground grid place-items-center text-sm font-semibold">
                  {u.n[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">{u.n}</p>
                  <p className="text-xs text-on-surface-variant">{u.e}</p>
                </div>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-surface-container">{u.role}</span>
            </div>
          ))}
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
      <Input defaultValue={defaultValue} />
    </div>
  );
}

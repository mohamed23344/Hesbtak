import { Link } from "@tanstack/react-router";
import { useI18n, type Lang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Languages, Sun, Moon } from "lucide-react";

export function BrandMark({ withText = true }: { withText?: boolean }) {
  const { t } = useI18n();
  return (
    <Link to="/" className="flex items-center gap-2 group">
      <div className="h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center text-primary-foreground font-bold shadow-soft">
        ح
      </div>
      {withText && (
        <span className="font-semibold text-on-surface tracking-tight">{t("appName")}</span>
      )}
    </Link>
  );
}

export function LangToggle() {
  const { lang, setLang } = useI18n();
  const next: Lang = lang === "en" ? "ar" : "en";
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLang(next)}
      className="gap-1.5 text-on-surface-variant"
    >
      <Languages className="h-4 w-4" />
      {lang === "en" ? "العربية" : "English"}
    </Button>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  const isDark = 
    theme === "dark" || 
    (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="text-on-surface-variant"
      title="Toggle theme"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

import { Link } from "@tanstack/react-router";
import { useI18n, type Lang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Languages, Sun, Moon } from "lucide-react";

export function BrandMark({
  withText = true,
  to = "/",
  forceLight = false,
}: {
  withText?: boolean;
  to?: string;
  forceLight?: boolean;
}) {
  const { theme } = useTheme();
  
  const isDark = 
    forceLight ||
    theme === "dark" || 
    (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <Link to={to} className="flex items-center gap-2 group focus-visible:outline-none">
      {withText ? (
        <img
          src={isDark ? "/logo-light.png" : "/logo-dark.png"}
          alt="Hesbetak.AI Logo"
          className="h-8 md:h-9 w-auto object-contain transition-transform duration-300 group-hover:scale-102"
        />
      ) : (
        <img
          src="/brand-icon.png"
          alt="Hesbetak.AI Icon"
          className="h-8 w-8 rounded-lg object-contain transition-transform duration-300 group-hover:scale-105"
        />
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

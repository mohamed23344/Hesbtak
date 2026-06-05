import type { ReactNode } from "react";
import { BrandMark, LangToggle, ThemeToggle } from "@/components/Brand";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function SocialButtons() {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <Button variant="outline" className="w-full justify-center gap-2 h-11" type="button">
        <GoogleIcon /> {t("continueGoogle")}
      </Button>
      <Button variant="outline" className="w-full justify-center gap-2 h-11" type="button">
        <FacebookIcon /> {t("continueFacebook")}
      </Button>
    </div>
  );
}

export function OrDivider() {
  const { t } = useI18n();
  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border-default" /></div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-card px-2 text-on-surface-variant">{t("orContinueWith")}</span>
      </div>
    </div>
  );
}

export default function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { dir } = useI18n();
  return (
    <div dir={dir} className="min-h-screen bg-gradient-hero grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-primary text-primary-foreground">
        <BrandMark />
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            Your finances, simplified — in English and العربية.
          </h2>
          <p className="mt-3 text-primary-foreground/80 max-w-md">
            Join thousands of SMBs using Hesbetak.AI to automate their bookkeeping.
          </p>
        </div>
        <div className="text-sm text-primary-foreground/70">
          © {new Date().getFullYear()} Hesbetak.AI
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between p-4 lg:p-6">
          <div className="lg:hidden"><BrandMark /></div>
          <div className="ms-auto flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-4 pb-10">
          <div className="w-full max-w-md">
            <div className="bg-card rounded-2xl border border-border-default shadow-card p-7">
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>}
              <div className="mt-6">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.7H12z" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M22 12a10 10 0 1 0-11.6 9.9V14.9H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.7-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" />
    </svg>
  );
}

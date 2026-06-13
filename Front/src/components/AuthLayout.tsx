import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BrandMark, LangToggle, ThemeToggle } from "@/components/Brand";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { api, saveSession } from "@/lib/api";
import { toast } from "sonner";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: Record<string, unknown>
          ) => void;
        };
      };
    };
  }
}

export function SocialButtons() {
  const navigate = useNavigate();
  const { t, dir } = useI18n();

  const [loading, setLoading] = useState(false);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as
    | string
    | undefined;

  useEffect(() => {
    if (!clientId) return;

    const initializeGoogle = () => {
      if (!window.google) return;

      window.google.accounts.id.initialize({
        client_id: clientId,

        callback: async ({ credential }) => {
          setLoading(true);

          try {
            const data = await api<any>("/auth/google", {
              method: "POST",
              body: JSON.stringify({
                credential,
              }),
            });

            saveSession(data);

            if (data.user?.globalRole === "admin") {
              navigate({
                to: "/admin",
                hash: "users",
                replace: true,
              });
            } else {
              navigate({
                to:
                  data.tenants?.length === 1
                    ? "/dashboard"
                    : "/select-organization",
                replace: true,
              });
            }
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Google sign-in failed"
            );

            setLoading(false);
          }
        },
      });
    };

    if (window.google) {
      initializeGoogle();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );

    if (existing) {
      existing.addEventListener("load", initializeGoogle, {
        once: true,
      });

      return () =>
        existing.removeEventListener(
          "load",
          initializeGoogle
        );
    }

    const script = document.createElement("script");

    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;

    script.onload = initializeGoogle;

    script.onerror = () => {
      toast.error("Failed to load Google Sign-In");
    };

    document.head.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [clientId, navigate]);

  const handleGoogleLogin = () => {
    if (!window.google) {
      toast.error("Google SDK not loaded");
      return;
    }

    try {
      window.google.accounts.id.prompt();
    } catch (e) {
      console.error(e);
      toast.error("Could not open Google Sign-In");
    }
  };

  if (!clientId) {
    return (
      <Button
        variant="outline"
        className="w-full h-11 justify-center gap-2.5"
        disabled
      >
        <GoogleIcon />
        {t("googleSignInNotConfigured")}
      </Button>
    );
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleGoogleLogin}
      className={[
        "w-full h-11 flex items-center justify-center gap-3",
        "rounded-lg border border-border bg-background",
        "text-sm font-medium text-foreground",
        "transition-colors hover:bg-muted/50 active:bg-muted",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        dir === "rtl" ? "flex-row-reverse" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {loading ? (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            opacity="0.25"
          />
          <path
            fill="currentColor"
            opacity="0.75"
            d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"
          />
        </svg>
      ) : (
        <GoogleIcon />
      )}

      <span>{t("signInWithGoogle")}</span>
    </button>
  );
}

export function OrDivider() {
  const { t } = useI18n();
  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border-default" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-card px-2 text-on-surface-variant">
          {t("orContinueWith")}
        </span>
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
    <div
      dir={dir}
      className="max-h-fit bg-gradient-hero grid lg:grid-cols-2 lg:"
    >
      <div className="hidden lg:flex flex-col justify-between p-12 xl:p-16 bg-gradient-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-accent/20 blur-3xl rounded-full" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-indigo-400/20 blur-3xl rounded-full" />

        <div className="relative z-10">
          <BrandMark forceLight large/>
        </div>

        <div className="relative z-10 my-auto py-12">
          <h2 className="max-w-2xl text-5xl xl:text-6xl font-bold leading-[1.08] tracking-tight">
            Your finances, simplified — in English and العربية.
          </h2>
          <p className="mt-6 text-primary-foreground/80 max-w-xl text-lg leading-relaxed">
            Join thousands of SMBs using Hesbetak.AI to automate their
            bookkeeping with bilingual artificial intelligence.
          </p>
        </div>

        <div className="relative z-10 text-sm text-primary-foreground/70">
          © {new Date().getFullYear()} Hesbetak.AI
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between p-4 lg:p-8">
          <div className="lg:hidden">
            <BrandMark />
          </div>
          <div className="ms-auto flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-lg">
            <div className="bg-card/80 glass-panel shadow-card p-8 lg:p-10 hover-glow rounded-3xl">
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
              {subtitle && (
                <p className="mt-2 text-base text-on-surface-variant">
                  {subtitle}
                </p>
              )}
              <div className="mt-7">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

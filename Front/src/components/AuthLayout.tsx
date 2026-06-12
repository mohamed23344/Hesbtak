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
          initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export function SocialButtons() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId) return;
    const render = () => {
      if (!window.google || !containerRef.current) return;
      containerRef.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          setLoading(true);
          try {
            const data = await api<any>("/auth/google", {
              method: "POST",
              body: JSON.stringify({ credential }),
            });
            saveSession(data);
            if (data.user.globalRole === "admin") {
              navigate({ to: "/admin", hash: "users", replace: true });
            } else {
              navigate({
                to: data.tenants?.length === 1 ? "/dashboard" : "/select-organization",
                replace: true,
              });
            }
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Google sign-in failed");
            setLoading(false);
          }
        },
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: Math.min(containerRef.current.clientWidth || 360, 400),
      });
    };

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      if (window.google) render();
      else existing.addEventListener("load", render, { once: true });
      return () => existing.removeEventListener("load", render);
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = render;
    script.onerror = () => toast.error("Could not load Google sign-in");
    document.head.appendChild(script);
    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [clientId, navigate]);

  return (
    <div className="min-h-11">
      {clientId ? (
        <div ref={containerRef} className={loading ? "pointer-events-none opacity-60" : ""} />
      ) : (
        <Button variant="outline" className="w-full justify-center gap-2 h-11" type="button" disabled>
          <GoogleIcon /> Google sign-in is not configured
        </Button>
      )}
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
      <div className="hidden lg:flex flex-col justify-between p-12 xl:p-16 bg-gradient-primary text-primary-foreground relative overflow-hidden">
        {/* Glow overlay */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-accent/20 blur-3xl rounded-full" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-indigo-400/20 blur-3xl rounded-full" />
        
        <div className="relative z-10">
          <BrandMark forceLight />
        </div>
        
        <div className="relative z-10 my-auto py-12">
          <h2 className="max-w-2xl text-5xl xl:text-6xl font-bold leading-[1.08] tracking-tight">
            Your finances, simplified — in English and العربية.
          </h2>
          <p className="mt-6 text-primary-foreground/80 max-w-xl text-lg leading-relaxed">
            Join thousands of SMBs using Hesbetak.AI to automate their bookkeeping with bilingual artificial intelligence.
          </p>
        </div>
        
        <div className="relative z-10 text-sm text-primary-foreground/70">
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
          <div className="w-full max-w-lg">
            <div className="bg-card/80 glass-panel shadow-card p-8 lg:p-10 hover-glow rounded-3xl">
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
              {subtitle && <p className="mt-2 text-base text-on-surface-variant">{subtitle}</p>}
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
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.7H12z" />
    </svg>
  );
}

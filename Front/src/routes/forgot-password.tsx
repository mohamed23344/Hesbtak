import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import AuthLayout from "@/components/AuthLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { api, setPendingEmail } from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPage });

function ForgotPage() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api<{ devCode?: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setPendingEmail(email);
      toast.success(data.devCode ? `Code sent. Dev code: ${data.devCode}` : "Code sent");
      nav({ to: "/verify-otp" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={t("forgot")} subtitle={t("forgotSubtitle")}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <Button className="w-full bg-gradient-primary h-11" disabled={loading}>
          {loading ? "..." : t("sendCode")}
        </Button>
      </form>
      <p className="mt-5 text-sm text-center text-on-surface-variant">
        {t("rememberIt")}{" "}
        <Link to="/login" className="text-primary font-medium hover:underline">{t("signIn")}</Link>
      </p>
    </AuthLayout>
  );
}

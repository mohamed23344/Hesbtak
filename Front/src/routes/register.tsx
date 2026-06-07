import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import AuthLayout, { SocialButtons, OrDivider } from "@/components/AuthLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { api, saveSession, setPendingEmail, setPendingOtpPurpose } from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/register")({ component: RegisterPage });

function RegisterPage() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api<any>("/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      saveSession(data);
      setPendingEmail(form.email);
      setPendingOtpPurpose("signup");
      toast.success("Account created. Check your email for the OTP code.");
      nav({ to: "/verify-otp" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={t("signUp")} subtitle={t("signUpSubtitle")}>
      <SocialButtons />
      <OrDivider />
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t("fullName")}</Label>
          <Input id="name" value={form.fullName} onChange={update("fullName")} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" type="email" value={form.email} onChange={update("email")} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("password")}</Label>
          <Input id="password" type="password" value={form.password} onChange={update("password")} minLength={8} required />
        </div>
        <Button className="w-full bg-gradient-primary h-11" disabled={loading}>
          {loading ? "..." : t("createAccount")}
        </Button>
      </form>
      <p className="mt-5 text-sm text-center text-on-surface-variant">
        {t("alreadyHaveAccount")}{" "}
        <Link to="/login" className="text-primary font-medium hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </AuthLayout>
  );
}

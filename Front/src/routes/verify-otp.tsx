import { createFileRoute, useNavigate } from "@tanstack/react-router";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api, getPendingEmail, getSession } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/verify-otp")({ component: VerifyOTP });

function VerifyOTP() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const session = getSession();
  const isPasswordReset = !session;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const email = getPendingEmail();
      if (!email) throw new Error("No email is waiting for verification");
      if (isPasswordReset) {
        await api("/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({ email, code, password }),
        });
        toast.success("Password reset");
        nav({ to: "/login" });
      } else {
        await api("/auth/verify-otp", {
          method: "POST",
          body: JSON.stringify({ email, code }),
        }).catch(() => null);
        nav({ to: "/onboarding" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={t("verifyEmailTitle")} subtitle={t("verifyEmailDesc")}>
      <form onSubmit={submit} className="space-y-6">
        <div className="flex justify-center">
          <InputOTP maxLength={6} value={code} onChange={setCode}>
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        {isPasswordReset && (
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            minLength={8}
            required
          />
        )}
        <Button className="w-full bg-gradient-primary h-11" disabled={code.length < 6 || loading || (isPasswordReset && password.length < 8)}>
          {loading ? "..." : t("verifyAndContinue")}
        </Button>
      </form>
    </AuthLayout>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import AuthLayout from "@/components/AuthLayout";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/accept-invitation")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: Page,
});

type Invitation = {
  email: string;
  role: string;
  organizationName: string;
  expiresAt: string;
};

function Page() {
  const nav = useNavigate();
  const { token } = Route.useSearch();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api<Invitation>(`/auth/invitations/${encodeURIComponent(token)}`)
      .then(setInvitation)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Invitation is invalid"))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await api("/auth/complete-invitation", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      toast.success("Password changed. You can now sign in.");
      nav({ to: "/login" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete invitation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthLayout
      title="Set your password"
      subtitle={
        invitation
          ? `Join ${invitation.organizationName} as ${invitation.role}.`
          : "Complete your workspace invitation."
      }
    >
      {loading ? (
        <p className="text-center text-sm text-on-surface-variant">Loading invitation...</p>
      ) : !invitation ? (
        <div className="text-center">
          <p className="text-sm text-on-surface-variant">This invitation is invalid or expired.</p>
          <Button asChild className="mt-4"><Link to="/login">Back to sign in</Link></Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-lg bg-surface-container p-3 text-sm">
            <p className="font-medium">{invitation.email}</p>
            <p className="text-xs text-on-surface-variant mt-1">
              The temporary password from the email cannot be used until you replace it here.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>
          <Button className="w-full bg-gradient-primary" disabled={saving}>
            {saving ? "Saving..." : "Set password and activate account"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "./dashboard.transactions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { api, getSession, updateSession } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/settings")({ component: Page });

type Member = {
  id: string;
  role: string;
  accessExpiresAt?: string | null;
  permissions?: string[];
  user: { id: string; fullName: string; email: string };
};

const VIEW_PERMISSIONS = [
  ["dashboard", "Financial dashboard"],
  ["reports", "Reports"],
  ["invoices", "Invoices"],
  ["accounts", "Chart of accounts"],
  ["journal", "Journal entries"],
  ["accounting", "Transactions and parties"],
  ["forecasting", "Forecasting"],
  ["assistant", "AI assistant"],
  ["ocr", "OCR"],
  ["notifications", "Notifications"],
] as const;

function Page() {
  const session = getSession();
  const tenant = session?.tenants.find((item) => item.organizationId === session.activeTenantId);
  const canEdit = tenant?.role === "owner" || tenant?.role === "accountant";
  const isOwner = tenant?.role === "owner";
  const [organization, setOrganization] = useState({
    name: tenant?.organizationName ?? "",
    industry: tenant?.industry ?? "",
    currency: tenant?.currency ?? "USD",
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [invite, setInvite] = useState({
    email: "",
    role: "viewer",
    accessExpiresAt: "",
    permissions: ["dashboard", "reports"],
  });

  const loadMembers = async () => {
    if (!isOwner) return;
    try {
      setMembers(await api<Member[]>(`/org/${tenant?.organizationId}/members`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load members");
    }
  };
  useEffect(() => { void loadMembers(); }, [tenant?.organizationId, isOwner]);

  const saveOrganization = async () => {
    try {
      await api(`/org/${tenant?.organizationId}`, { method: "PATCH", body: JSON.stringify(organization) });
      if (session && tenant) {
        updateSession({
          tenants: session.tenants.map((item) => item.organizationId === tenant.organizationId
            ? { ...item, organizationName: organization.name, industry: organization.industry, currency: organization.currency }
            : item),
        });
      }
      toast.success("Organization settings updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update organization");
    }
  };

  const sendInvitation = async () => {
    try {
      await api(`/org/${tenant?.organizationId}/invitations`, {
        method: "POST",
        body: JSON.stringify({
          email: invite.email,
          role: invite.role,
          accessExpiresAt: invite.role === "viewer" && invite.accessExpiresAt
            ? new Date(`${invite.accessExpiresAt}T23:59:59`).toISOString()
            : undefined,
          permissions: invite.role === "viewer" ? invite.permissions : undefined,
        }),
      });
      toast.success("Invitation email sent");
      setInvite({ ...invite, email: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send invitation");
    }
  };

  const removeMember = async (id: string) => {
    try {
      await api(`/org/${tenant?.organizationId}/members/${id}`, { method: "DELETE" });
      await loadMembers();
      toast.success("Access removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove member");
    }
  };

  const deleteOrganization = async () => {
    if (!confirm(`Delete ${tenant?.organizationName}? This permanently deletes its financial data.`)) return;
    try {
      await api(`/org/${tenant?.organizationId}`, { method: "DELETE" });
      const tenants = session?.tenants.filter((item) => item.organizationId !== tenant?.organizationId) ?? [];
      updateSession({ tenants, activeTenantId: tenants.length === 1 ? tenants[0].organizationId : undefined });
      window.location.assign(tenants.length ? "/select-organization" : "/onboarding");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete organization");
    }
  };

  return <div className="space-y-5">
    <Header title="Settings" desc="Manage your profile, organization, access, and security." />

    <Section title="Profile and security">
      <div className="grid sm:grid-cols-2 gap-4">
        <ReadField label="Full name" value={session?.user.fullName ?? ""} />
        <ReadField label="Email" value={session?.user.email ?? ""} />
        <ReadField label="Organization role" value={tenant?.role ?? ""} />
        <div className="space-y-1.5"><Label>Password</Label><Button asChild variant="outline" className="w-full"><Link to="/forgot-password">Change password with OTP</Link></Button></div>
      </div>
    </Section>

    {canEdit && <Section title="Organization settings">
      <div className="grid sm:grid-cols-3 gap-4">
        <EditField label="Name" value={organization.name} onChange={(name) => setOrganization({ ...organization, name })} />
        <EditField label="Industry" value={organization.industry} onChange={(industry) => setOrganization({ ...organization, industry })} />
        <EditField label="Currency" value={organization.currency} onChange={(currency) => setOrganization({ ...organization, currency })} />
      </div>
      <Button className="mt-4" onClick={saveOrganization}>Save organization settings</Button>
    </Section>}

    {isOwner && <Section title="Invite external users and staff">
      <div className="grid md:grid-cols-3 gap-3">
        <EditField label="Email" value={invite.email} onChange={(email) => setInvite({ ...invite, email })} type="email" />
        <div className="space-y-1.5"><Label>Role</Label><select value={invite.role} onChange={(event) => setInvite({ ...invite, role: event.target.value })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="accountant">Accountant / staff</option><option value="viewer">Viewer</option><option value="owner">Owner</option></select></div>
        {invite.role === "viewer" && <EditField label="Access end date (optional)" value={invite.accessExpiresAt} onChange={(accessExpiresAt) => setInvite({ ...invite, accessExpiresAt })} type="date" />}
      </div>
      {invite.role === "viewer" && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
        {VIEW_PERMISSIONS.map(([key, text]) => <label key={key} className="flex items-center gap-2 text-sm"><Checkbox checked={invite.permissions.includes(key)} onCheckedChange={() => setInvite({ ...invite, permissions: invite.permissions.includes(key) ? invite.permissions.filter((value) => value !== key) : [...invite.permissions, key] })} />{text}</label>)}
      </div>}
      <Button className="mt-4" onClick={sendInvitation}>Send secure invitation</Button>
    </Section>}

    {isOwner && <Section title="Organization members">
      <div className="space-y-2">{members.map((member) => <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 border border-border-default rounded-xl p-3"><div><p className="font-medium text-sm">{member.user.fullName}</p><p className="text-xs text-on-surface-variant">{member.user.email}</p></div><div className="flex items-center gap-2"><Badge className="capitalize">{member.role}</Badge>{member.accessExpiresAt && <span className="text-xs">Until {new Date(member.accessExpiresAt).toLocaleDateString()}</span>}{member.user.id !== session?.user.id && <Button size="sm" variant="destructive" onClick={() => removeMember(member.id)}>Remove</Button>}</div></div>)}</div>
    </Section>}

    {isOwner && <Section title="Owner actions">
      <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><a href="/onboarding?new=1">Create another organization</a></Button><Button variant="destructive" onClick={deleteOrganization}>Delete organization</Button></div>
    </Section>}
  </div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="bg-card border border-border-default rounded-2xl p-5 shadow-soft"><h3 className="font-semibold mb-4">{title}</h3>{children}</div>;
}
function ReadField({ label, value }: { label: string; value: string }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Input value={value} readOnly /></div>;
}
function EditField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

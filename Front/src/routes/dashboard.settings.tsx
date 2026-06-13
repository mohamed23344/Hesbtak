import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "./dashboard.transactions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { api, getSession, updateSession } from "@/lib/api";
import { toast } from "sonner";
import { ExternalLink, Mail, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/dashboard/settings")({
  validateSearch: (search: Record<string, unknown>): { reference?: string; payment?: string } => ({
    reference: typeof search.reference === "string" ? search.reference : undefined,
    payment: typeof search.payment === "string" ? search.payment : undefined,
  }),
  component: Page,
});

type Member = {
  id: string;
  role: string;
  isActive: boolean;
  accessExpiresAt?: string | null;
  permissions?: string[];
  user: { id: string; fullName: string; email: string };
};

type Plan = {
  id: string;
  code: string;
  name: string;
  price: string | number;
  currency: string;
  billingCycle: string;
  features: Record<string, boolean>;
};

type CurrentSubscription = {
  id: string;
  status: string;
  currentPeriodEnd: string;
  paymentReference?: string | null;
  plan: Plan;
} | null;

type NotificationReport = {
  id: string;
  type: string;
  frequency: string;
  recipients: string[];
  isActive: boolean;
  lastSentAt?: string | null;
  nextSendAt?: string | null;
};

type Ticket = {
  id: string;
  subject: string;
  category: string;
  message: string;
  status: string;
  adminReply?: string | null;
  createdAt: string;
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
  const nav = useNavigate();
  const { reference, payment } = Route.useSearch();
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
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<CurrentSubscription>(null);
  const [checkoutPlanId, setCheckoutPlanId] = useState("");
  const [notificationReports, setNotificationReports] = useState<NotificationReport[]>([]);
  const [invite, setInvite] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "viewer",
    accessExpiresAt: "",
    permissions: ["dashboard", "reports"],
  });

  // Support ticket state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [sending, setSending] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: "", category: "technical", message: "" });

  const loadMembers = async () => {
    if (!isOwner) return;
    try {
      setMembers(await api<Member[]>(`/org/${tenant?.organizationId}/members`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load members");
    }
  };

  const loadNotificationReports = async () => {
    try {
      setNotificationReports(await api<NotificationReport[]>("/notifications/reports"));
    } catch {
      // silently ignore if endpoint doesn't exist yet
    }
  };

  const loadTickets = () =>
    api<Ticket[]>("/support/tickets")
      .then(setTickets)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load support tickets"));

  useEffect(() => { void loadMembers(); }, [tenant?.organizationId, isOwner]);
  useEffect(() => { void loadNotificationReports(); }, [tenant?.organizationId]);
  useEffect(() => { void loadTickets(); }, [tenant?.organizationId]);

  useEffect(() => {
    api<Plan[]>("/plans")
      .then(setPlans)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load plans"));
    if (tenant?.organizationId) {
      api<CurrentSubscription>("/subscriptions/current")
        .then((result) => {
          setSubscription(result);
          if (session && tenant && result?.status === "active") {
            updateSession({
              tenants: session.tenants.map((item) =>
                item.organizationId === tenant.organizationId
                  ? {
                      ...item,
                      subscription: {
                        status: result.status,
                        currentPeriodEnd: result.currentPeriodEnd,
                        plan: {
                          code: result.plan.code,
                          name: result.plan.name,
                          features: result.plan.features,
                        },
                      },
                    }
                  : item,
              ),
            });
          }
        })
        .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load subscription"));
    }
  }, [tenant?.organizationId]);

  useEffect(() => {
    if (!reference || !tenant?.organizationId) return;
    api<CurrentSubscription>("/subscriptions/verify", {
      method: "POST",
      body: JSON.stringify({ reference }),
    }).then((result) => {
      setSubscription(result);
      if (session && tenant && result?.status === "active") {
        updateSession({
          tenants: session.tenants.map((item) =>
            item.organizationId === tenant.organizationId
              ? {
                  ...item,
                  subscription: {
                    status: result.status,
                    currentPeriodEnd: result.currentPeriodEnd,
                    plan: {
                      code: result.plan.code,
                      name: result.plan.name,
                      features: result.plan.features,
                    },
                  },
                }
              : item,
          ),
        });
      }
      if (result?.status === "active") toast.success("Subscription activated");
      else if (payment === "failed") toast.error("Payment was not completed");
      else toast.info("Payment is still being confirmed. Refresh in a few seconds.");
    }).catch((error) => toast.error(error instanceof Error ? error.message : "Could not verify payment"));
  }, [tenant?.organizationId, reference, payment]);

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
      const result = await api<{ joinedExistingUser?: boolean }>(`/org/${tenant?.organizationId}/invitations`, {
        method: "POST",
        body: JSON.stringify({
          email: invite.email,
          fullName: invite.fullName,
          password: invite.password,
          role: invite.role,
          accessExpiresAt: invite.role === "viewer" && invite.accessExpiresAt
            ? new Date(`${invite.accessExpiresAt}T23:59:59`).toISOString()
            : undefined,
          permissions: invite.role === "viewer" ? invite.permissions : undefined,
        }),
      });
      toast.success(result.joinedExistingUser ? "Existing user added to the organization" : "Invitation email sent");
      setInvite({ ...invite, fullName: "", email: "", password: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send invitation");
    }
  };

  const subscribe = async (planId: string) => {
    setCheckoutPlanId(planId);
    try {
      const result = await api<{ checkoutUrl: string }>("/subscriptions/checkout", {
        method: "POST",
        body: JSON.stringify({ planId }),
      });
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start checkout");
      setCheckoutPlanId("");
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

  const setMemberActive = async (member: Member, isActive: boolean) => {
    try {
      await api(`/org/${tenant?.organizationId}/members/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
      await loadMembers();
      toast.success(isActive ? "Member access reactivated" : "Member access deactivated and notification sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update member access");
    }
  };

  const deleteOrganization = async () => {
    if (!confirm(`Delete ${tenant?.organizationName}? This permanently deletes its financial data.`)) return;
    try {
      await api(`/org/${tenant?.organizationId}`, { method: "DELETE" });
      const tenants = session?.tenants.filter((item) => item.organizationId !== tenant?.organizationId) ?? [];
      updateSession({ tenants, activeTenantId: tenants.length === 1 ? tenants[0].organizationId : undefined });
      nav({ to: tenants.length ? "/select-organization" : "/onboarding" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete organization");
    }
  };

  const toggleNotificationReport = async (report: NotificationReport) => {
    try {
      await api(`/notifications/reports/${report.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !report.isActive }),
      });
      await loadNotificationReports();
      toast.success(report.isActive ? "Report disabled" : "Report enabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update notification report");
    }
  };

  // Support ticket submission
  const submitTicket = async () => {
    if (!ticketForm.subject.trim() || !ticketForm.message.trim()) {
      toast.error("Subject and message are required");
      return;
    }
    setSending(true);
    try {
      await api("/support/tickets", {
        method: "POST",
        body: JSON.stringify({ ...ticketForm, organizationId: session?.activeTenantId }),
      });
      setTicketForm({ subject: "", category: "technical", message: "" });
      await loadTickets();
      toast.success("Support ticket submitted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit support ticket");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <Header title="Settings" desc="Manage your profile, organization, access, and security." />

      <Section title="Profile and security">
        <div className="grid sm:grid-cols-2 gap-4">
          <ReadField label="Full name" value={session?.user.fullName ?? ""} />
          <ReadField label="Email" value={session?.user.email ?? ""} />
          <ReadField label="Organization role" value={tenant?.role ?? ""} />
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Button asChild variant="outline" className="w-full">
              <Link to="/forgot-password">Change password with OTP</Link>
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Subscription plans">
        <div className="mb-4 rounded-lg bg-surface-container px-4 py-3 text-sm">
          {subscription?.status === "active"
            ? <>Current plan: <strong>{subscription.plan.name}</strong> until {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</>
            : "No active paid plan. Core accounting remains available, while AI features require AI Pro."}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const active = subscription?.status === "active" && subscription.plan.id === plan.id;
            return (
              <div key={plan.id} className={`rounded-xl border p-5 ${active ? "border-primary bg-primary/5" : "border-border-default"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold">{plan.name}</h4>
                    <p className="text-xs text-on-surface-variant mt-1">{plan.billingCycle} billing</p>
                  </div>
                  {active && <Badge>Current</Badge>}
                </div>
                <p className="text-3xl font-semibold mt-4">
                  {Number(plan.price).toLocaleString()}{" "}
                  <span className="text-sm font-normal">{plan.currency}/month</span>
                </p>
                <div className="mt-4 space-y-2 text-sm">
                  <p>Accounting, journals, reports, and forecasting</p>
                  <p>{plan.features.chatbot ? "AI financial chatbot included" : "AI financial chatbot not included"}</p>
                  <p>{plan.features.invoiceAiExtraction ? "AI invoice extraction included" : "AI invoice extraction not included"}</p>
                </div>
                {isOwner && (
                  <Button
                    className="mt-5 w-full"
                    variant={active ? "outline" : "default"}
                    disabled={active || checkoutPlanId === plan.id}
                    onClick={() => void subscribe(plan.id)}
                  >
                    {active ? "Active plan" : checkoutPlanId === plan.id ? "Opening Paymob..." : "Subscribe with Paymob"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {canEdit && (
        <Section title="Organization settings">
          <div className="grid sm:grid-cols-3 gap-4">
            <EditField label="Name" value={organization.name} onChange={(name) => setOrganization({ ...organization, name })} />
            <EditField label="Industry" value={organization.industry} onChange={(industry) => setOrganization({ ...organization, industry })} />
            <EditField label="Currency" value={organization.currency} onChange={(currency) => setOrganization({ ...organization, currency })} />
          </div>
          <Button className="mt-4" onClick={saveOrganization}>Save organization settings</Button>
        </Section>
      )}

      <Section title="Notification reports">
        {notificationReports.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No scheduled notification reports configured.</p>
        ) : (
          <div className="space-y-2">
            {notificationReports.map((report) => (
              <div
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-border-default rounded-xl p-3"
              >
                <div>
                  <p className="font-medium text-sm capitalize">{report.type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-on-surface-variant">
                    {report.frequency} · {report.recipients.join(", ")}
                    {report.nextSendAt && ` · Next: ${new Date(report.nextSendAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={report.isActive ? "default" : "secondary"}>
                    {report.isActive ? "Active" : "Paused"}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => void toggleNotificationReport(report)}>
                    {report.isActive ? "Pause" : "Enable"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {isOwner && (
        <Section title="Invite external users and staff">
          <div className="grid md:grid-cols-4 gap-3">
            <EditField label="Full name" value={invite.fullName} onChange={(fullName) => setInvite({ ...invite, fullName })} />
            <EditField label="Email" value={invite.email} onChange={(email) => setInvite({ ...invite, email })} type="email" />
            <EditField label="Temporary password (new users only)" value={invite.password} onChange={(password) => setInvite({ ...invite, password })} type="password" />
            <div className="space-y-1.5">
              <Label>Role</Label>
              <select
                value={invite.role}
                onChange={(event) => setInvite({ ...invite, role: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="accountant">Accountant / staff</option>
                <option value="viewer">Viewer</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            {invite.role === "viewer" && (
              <EditField
                label="Access end date (optional)"
                value={invite.accessExpiresAt}
                onChange={(accessExpiresAt) => setInvite({ ...invite, accessExpiresAt })}
                type="date"
              />
            )}
          </div>
          {invite.role === "viewer" && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
              {VIEW_PERMISSIONS.map(([key, text]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={invite.permissions.includes(key)}
                    onCheckedChange={() =>
                      setInvite({
                        ...invite,
                        permissions: invite.permissions.includes(key)
                          ? invite.permissions.filter((value) => value !== key)
                          : [...invite.permissions, key],
                      })
                    }
                  />
                  {text}
                </label>
              ))}
            </div>
          )}
          <Button
            className="mt-4"
            onClick={sendInvitation}
            disabled={!invite.email || Boolean(invite.password && invite.password.length < 8)}
          >
            Add member or send invitation
          </Button>
        </Section>
      )}

      {isOwner && (
        <Section title="Organization members">
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-border-default rounded-xl p-3"
              >
                <div>
                  <p className="font-medium text-sm">{member.user.fullName}</p>
                  <p className="text-xs text-on-surface-variant">{member.user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={member.isActive ? "default" : "secondary"} className="capitalize">
                    {member.isActive ? member.role : "Deactivated"}
                  </Badge>
                  {member.accessExpiresAt && (
                    <span className="text-xs">Until {new Date(member.accessExpiresAt).toLocaleDateString()}</span>
                  )}
                  {member.user.id !== session?.user.id && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => void setMemberActive(member, !member.isActive)}>
                        {member.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => void removeMember(member.id)}>
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {isOwner && (
        <Section title="Owner actions">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/onboarding" search={{ newOrganization: true }}>Create another organization</Link>
            </Button>
            <Button variant="destructive" onClick={deleteOrganization}>Delete organization</Button>
          </div>
        </Section>
      )}

      {/* Help & Support section with integrated ticket form */}
      <Section title="Help and support">
        {/* Support ticket form */}
        <div className="mb-6">
          <h4 className="font-medium mb-2">Contact support</h4>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                value={ticketForm.subject}
                maxLength={160}
                onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <select
                value={ticketForm.category}
                onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="technical">Technical issue</option>
                <option value="account">Account and access</option>
                <option value="billing">Billing</option>
                <option value="feature_request">Feature request</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>How can we help?</Label>
              <Textarea
                value={ticketForm.message}
                maxLength={5000}
                onChange={(e) => setTicketForm({ ...ticketForm, message: e.target.value })}
                className="min-h-36"
              />
            </div>
          </div>
          <Button className="mt-3" onClick={submitTicket} disabled={sending}>
            {sending ? "Sending..." : "Submit ticket"}
          </Button>
        </div>

        {/* Existing support channels */}
        <div className="border-t border-border-default pt-6 mb-6">
          <h4 className="font-medium mb-3">Other ways to get help</h4>
          <div className="grid sm:grid-cols-3 gap-3">
            <a
              href="mailto:support@hesbetak.ai"
              className="flex items-center gap-3 rounded-xl border border-border-default p-4 hover:bg-surface-container transition-colors"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Email support</p>
                <p className="text-xs text-on-surface-variant">support@hesbetak.ai</p>
              </div>
            </a>
            <a
              href="https://wa.me/201000000000"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-xl border border-border-default p-4 hover:bg-surface-container transition-colors"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">WhatsApp</p>
                <p className="text-xs text-on-surface-variant">Chat with our team</p>
              </div>
            </a>
            <a
              href="https://docs.hesbetak.ai"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-xl border border-border-default p-4 hover:bg-surface-container transition-colors"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <ExternalLink className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Documentation</p>
                <p className="text-xs text-on-surface-variant">docs.hesbetak.ai</p>
              </div>
            </a>
          </div>
        </div>

        {/* List of user's tickets */}
        <div>
          <h4 className="font-medium mb-3">Your support tickets</h4>
          <div className="divide-y divide-border-default border border-border-default rounded-xl overflow-hidden">
            {tickets.length ? (
              tickets.map((ticket) => (
                <article key={ticket.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{ticket.subject}</h3>
                      <p className="text-xs text-on-surface-variant mt-1 capitalize">
                        {ticket.category.replace("_", " ")} · {String(ticket.createdAt).slice(0, 10)}
                      </p>
                    </div>
                    <Badge
                      variant={ticket.status === "resolved" || ticket.status === "closed" ? "secondary" : "default"}
                      className="capitalize"
                    >
                      {ticket.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-sm mt-3 whitespace-pre-wrap">{ticket.message}</p>
                  {ticket.adminReply && (
                    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <p className="text-xs font-semibold text-primary">SUPPORT REPLY</p>
                      <p className="text-sm mt-2 whitespace-pre-wrap">{ticket.adminReply}</p>
                    </div>
                  )}
                </article>
              ))
            ) : (
              <p className="p-8 text-center text-sm text-on-surface-variant">No support tickets yet.</p>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border-default rounded-2xl p-5 shadow-soft">
      <h3 className="font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} readOnly />
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}